/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
'use strict';

import {
	IPCMessageReader, IPCMessageWriter,
	createConnection, IConnection, TextDocumentSyncKind,
	TextDocuments, TextDocument, Diagnostic, DiagnosticSeverity,
	InitializeParams, InitializeResult, TextDocumentPositionParams,
	CompletionItem, CompletionItemKind
} from 'vscode-languageserver';

import {spawn, exec, ChildProcess} from "child_process"
import {parse} from "url"
import {tmpdir, platform} from "os"
import {writeFileSync, readFileSync} from "fs"
import * as path from "path"
import {Socket} from "net"

// Create a connection for the server. The connection uses Node's IPC as a transport
let connection: IConnection = createConnection(new IPCMessageReader(process), new IPCMessageWriter(process));

// Create a simple text document manager. The text document manager
// supports full document sync only
let documents: TextDocuments = new TextDocuments();
// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// After the server has started the client sends an initilize request. The server receives
// in the passed params the rootPath of the workspace plus the client capabilites. 
let workspaceRoot: string;
connection.onInitialize((params): Promise<InitializeResult> => {
	workspaceRoot = params.rootPath;
	
	return new Promise<InitializeResult>((resolve, reject) => {
		let res = resolve.bind({
			capabilities: {
				// Tell the client that the server works in FULL text document sync mode
				textDocumentSync: documents.syncKind,
				// Tell the client that the server support code complete
				completionProvider: {
					resolveProvider: false
				}
			}
		});
		
		let s = startJavaServer();
		javaServer.stdout.on("data", data => {
			if(data.toString().indexOf("RUNNING") !== -1) {
				process.stdout.write("Java server started \n");
				res();	
			}
			else if(data.toString().indexOf("PORT_USED") !== -1) {
                process.stdout.write("Java server already running \n");
                process.nextTick(() => javaServer = null);
                res();
            }
		})
		
	});
	
});

process.on("exit", (code) => {
	process.stderr.write("process.exit ("+code+"): Stopping Java Language Server\n");
	javaServer && (javaServer.stdout.pause(), javaServer.stderr.pause(), true) && javaServer.kill("SIGINT");
	createSocket().write("KILL");
});

process.on("SIGINT", (code) => {
	process.stderr.write("process.exit ("+code+"): Stopping Java Language Server\n");
	javaServer && (javaServer.stdout.pause(), javaServer.stderr.pause(), true) && javaServer.kill("SIGINT");
});

process.on("SIGTERM", (code) => {
	process.stderr.write("process.exit ("+code+"): Stopping Java Language Server\n");
	javaServer && (javaServer.stdout.pause(), javaServer.stderr.pause(), true) && javaServer.kill("SIGINT");
});

process.on('uncaughtException', (err) => {
  process.stderr.write(`Caught exception: ${err} \n ${err.stack} \n\n`);
  javaServer && (javaServer.stdout.pause(), javaServer.stderr.pause(), true) && javaServer.kill("SIGINT");
});

// The java process which handles linting
let javaServer: ChildProcess;
function startJavaServer() {
	process.stdout.write("Starting Java Language Server\n");
	
	let serverPath = path.resolve(__dirname, "..", "server.jar");
	javaServer = spawn("java", ["-jar", serverPath]);
	javaServer.stderr.pipe(process.stderr);
}

let bounce = void 0;
let bounceInterval = 100;
// Debounce validation to reduce traffic
documents.onDidChangeContent((change) => {
	if(bounce)
		clearTimeout(bounce);
	bounce = setTimeout(() => {
		validateTextDocument(change.document);
	}, bounceInterval);
});

// The settings interface describe the server relevant settings part
interface Settings {
	java: JavaSettings;
}

// These are the example settings we defined in the client's package.json
// file
interface JavaSettings {
	classPath: string[];
	jdk: string;
}

// hold setting
let classPath = "";
let jdk = "";
// The settings have changed. Is send on server activation
// as well.
connection.onDidChangeConfiguration(onDidChangeConfiguration);

function onDidChangeConfiguration(change) {
	let settings = <Settings>change.settings;
	classPath = (settings.java.classPath || []).map(cp => path.resolve(workspaceRoot, cp)).join(platform() === "win32" ? ";" : ":");	
	jdk = settings.java.jdk;
		
	//------- trasnfer settings to java server
	if(classPath) {
		let socket1 = createSocket();
		socket1.write("SET" + "\t" + "CLASSPATH" + "\t" + classPath + "\n");
	}
	
	if(jdk) {
		let socket2 = createSocket();
		socket2.write("SET" + "\t" + "JDK" + "\t" + jdk + "\n");
	}
	
	// Revalidate any open text documents
	documents.all().forEach(validateTextDocument);
};

function validateTextDocument(textDocument: TextDocument): void {
	let file = global.unescape(parse(textDocument.uri).pathname.substring(1));
	let fileName = path.basename(file);
	
	let socket = createSocket();
	socket.write("LINT" + "\t" + fileName + "\n");
	socket.write(textDocument.getText() + "\n");
	socket.write("END\n");
	socket.on("data", data => {
		let str = data.toString().replace(/\n/gm, " ").replace(/\s*$/, "");
		let json = JSON.parse(str);
		let diagnostics = json.map(d => {
			return {
				range: {
				start: {line: (+d.line)-1, character: +d.position},
				end: {line: (+d.line)-1, character: +d.position}
			},
			message: d.message,
			severity: DiagnosticSeverity.Error,
			source: "java"
			}
		});
		connection.sendDiagnostics({ uri: textDocument.uri, diagnostics});
	});	
}

connection.onDidChangeWatchedFiles((change) => {
	try {
		let configFile = readFileSync(change.changes[0].uri.replace("file://", "")).toString();
		let content = {
			settings: {
				java: JSON.parse(configFile)
			}
		}
		onDidChangeConfiguration(content);
	} catch(e) {
		process.stderr.write(`Error while processing .javaconfig file: ${e}`);
	}
});

function createSocket(): Socket {
	let s = new Socket();
	/*
	s.on("error", (err) => {
		process.stderr.write("Socket error: " + err + "\n");
	});
	*/
	s.connect(56789);
	
	return s;
}

/*
// This handler provides the initial list of the completion items.
connection.onCompletion((textDocumentPosition: TextDocumentPositionParams): CompletionItem[] => {
	// The pass parameter contains the position of the text document in 
	// which code complete got requested. For the example we ignore this
	// info and always provide the same completion items.
	return [
		{
			label: 'TypeScript',
			kind: CompletionItemKind.Text,
			data: 1
		},
		{
			label: 'JavaScript',
			kind: CompletionItemKind.Text,
			data: 2
		}
	]
});

// This handler resolve additional information for the item selected in
// the completion list.
connection.onCompletionResolve((item: CompletionItem): CompletionItem => {
	if (item.data === 1) {
		item.detail = 'TypeScript details',
		item.documentation = 'TypeScript documentation'
	} else if (item.data === 2) {
		item.detail = 'JavaScript details',
		item.documentation = 'JavaScript documentation'
	}
	return item;
});
*/

/*
connection.onDidOpenTextDocument((params) => {
	// A text document got opened in VSCode.
	// params.uri uniquely identifies the document. For documents store on disk this is a file URI.
	// params.text the initial full content of the document.
	connection.console.log(`${params.uri} opened.`);
});

connection.onDidChangeTextDocument((params) => {
	// The content of a text document did change in VSCode.
	// params.uri uniquely identifies the document.
	// params.contentChanges describe the content changes to the document.
	connection.console.log(`${params.uri} changed: ${JSON.stringify(params.contentChanges)}`);
});

connection.onDidCloseTextDocument((params) => {
	// A text document got closed in VSCode.
	// params.uri uniquely identifies the document.
	connection.console.log(`${params.uri} closed.`);
});
*/

// Listen on the connection
connection.listen();