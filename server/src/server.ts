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
import {tmpdir} from "os"
import {writeFileSync} from "fs"
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
connection.onInitialize((params): InitializeResult => {
	startJavaServer();
	
	workspaceRoot = params.rootPath;
	return {
		capabilities: {
			// Tell the client that the server works in FULL text document sync mode
			textDocumentSync: documents.syncKind,
			// Tell the client that the server support code complete
			completionProvider: {
				resolveProvider: true
			}
		}
	}
});

let javaServer: ChildProcess;

function startJavaServer() {
	let serverPath = path.resolve(__dirname, "..", "..", "Java-Language-Server", "server.jar");
	javaServer = spawn("java", ["-jar", serverPath]);
	javaServer.stderr.pipe(process.stderr);
}

// The content of a text document has changed. This event is emitted
// when the text document first opened or when its content has changed.
let validate = void 0;
documents.onDidChangeContent((change) => {
	if(validate)
		clearTimeout(validate);
	validate = setTimeout(() => {
		validateTextDocument(change.document);
	}, 100);
});

// The settings interface describe the server relevant settings part
interface Settings {
	java: ExampleSettings;
}

// These are the example settings we defined in the client's package.json
// file
interface ExampleSettings {
	classPath: string[];
	jdk: string;
}

// hold the maxNumberOfProblems setting
let classPath = "";
let jdk = "";
// The settings have changed. Is send on server activation
// as well.
connection.onDidChangeConfiguration((change) => {
	let settings = <Settings>change.settings;
	classPath = settings.java.classPath.join(";");
	jdk = settings.java.jdk;
	
	
	let socket1 = new Socket();
	socket1.connect(56789);
	socket1.write("SET" + "\t" + "CLASSPATH" + "\t" + classPath + "\n");
	let socket2 = new Socket();
	socket2.connect(56789);
	socket2.write("SET" + "\t" + "JDK" + "\t" + jdk + "\n");
	
	// Revalidate any open text documents
	documents.all().forEach(validateTextDocument);
});

function validateTextDocument(textDocument: TextDocument): void {
	let i = 0;
	let diagnostics: Diagnostic[] = [];
	
	let file = global.unescape(parse(textDocument.uri).pathname.substring(1));
	let fileName = path.basename(file);
	
	let socket = new Socket();
	socket.connect(56789);
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
	
	/*
	let tmpFile = path.resolve(tmpdir(), fileName); 
	writeFileSync(tmpFile, textDocument.getText())
	
	let data: Buffer = new Buffer("");
	let javac = spawn("javac", [tmpFile]);
	javac.stderr.on("data", (buffer) => {
		if(data)
			data = Buffer.concat([data, buffer])
		else
			data = buffer;
	});
	
	javac.on("close", () => {
		if(!data || !data.toString()) {
			connection.sendDiagnostics({ uri: textDocument.uri, diagnostics: [] });
			return;
		}
		
		let position = getErrorPosition(data);
		let {err, lineNr} = getErrorAndLine(data.toString());
		diagnostics.push({
			range: {
				start: {line: lineNr-1, character: position},
				end: {line: lineNr-1, character: position}
			},
			message: err,
			severity: DiagnosticSeverity.Error,
			source: "java"
		});
		connection.sendDiagnostics({ uri: textDocument.uri, diagnostics: diagnostics.slice(0,1) });
	});
	*/
}

function getErrorAndLine(line: string): {err:string, lineNr:number} {
	try {
		let [_, lineNr, err] = line.match(/\.java:(\d+): error: (.*)/);
		return {err, lineNr: +lineNr};
	} catch(e) {
		return {
			err: "Error while running 'javac'",
			lineNr: 1
		}
	}
}

function getErrorPosition(buffer: Buffer): number {
	let caretPos = ((buf: Buffer) => {
		let pos = buf.length-1;
		while(pos > -1 && buf.readInt8(pos) !== "^".charCodeAt(0)) pos--;
		return pos;
	})(buffer);
	
	let offset = ((buf: Buffer, pos) => {
		let n = 0
		while(pos > -1 && buf.readInt8(pos) === " ".charCodeAt(0)) pos-- && n++;
		return n;
	})(buffer, caretPos-1);
	
	offset = offset < 1 ? 1 : offset;
	return offset;
}

connection.onDidChangeWatchedFiles((change) => {
	// Monitored files have change in VSCode
	connection.console.log('We recevied an file change event');
});


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