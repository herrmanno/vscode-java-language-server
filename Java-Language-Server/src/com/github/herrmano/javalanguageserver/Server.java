package com.github.herrmano.javalanguageserver;

import java.io.BufferedReader;
import java.io.DataOutputStream;
import java.io.File;
import java.io.FileWriter;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.OutputStreamWriter;
import java.io.PrintWriter;
import java.io.Writer;
import java.net.ServerSocket;
import java.net.Socket;
import java.net.UnknownHostException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Arrays;
import java.util.List;

import javax.tools.Diagnostic;
import javax.tools.DiagnosticCollector;
import javax.tools.JavaCompiler;
import javax.tools.JavaCompiler.CompilationTask;
import javax.tools.JavaFileObject;
import javax.tools.StandardJavaFileManager;
import javax.tools.ToolProvider;

public class Server {

	ServerSocket socket;
	private boolean abort = false;
	private Path tmpDir;
	
	public void start(int port) throws UnknownHostException, IOException {
		this.tmpDir = Files.createTempDirectory("java-languageserver");
		socket = new ServerSocket(port);
		this.loop();
	}
	
	protected void loop() {
		while(!this.abort) {
			try {
				this.handle();
			} catch (Exception e) {
				e.printStackTrace();
			}
		}
	}

	protected void handle() throws Exception {
		Socket connSocket = this.socket.accept();
		BufferedReader ir = new BufferedReader(new InputStreamReader(connSocket.getInputStream()));
		PrintWriter os = new PrintWriter(connSocket.getOutputStream(), true);             
		
		this.listen(ir, os);
		connSocket.close();
	}
	
	protected void listen(BufferedReader ir, PrintWriter os) throws Exception {
		String header = ir.readLine();
		String method = header.split(" ")[0];
		String className = header.split(" ")[1];
		String classPath = header.split(" ")[2];
		
		switch (method) {
		case "LINT":
			this.onLint(ir, os, className, classPath);
			break;

		default:
			this.onError(ir, os);
			break;
		}
	}

	private void onLint(BufferedReader ir, PrintWriter os, String className, String classPath) throws Exception {
		String classString = "";
		String line;
		do {
			line = ir.readLine();
			classString += line.equals("END") ? "" : (line + "\n");
		} while(!line.equals("END"));
		
		//------- Write class to temp file
		File javaSrcFile = this.tmpDir.resolve(className).toFile();
		Writer p = new FileWriter( javaSrcFile );
		p.write( classString );
		p.close();
		
		//------ Compile via API
		JavaCompiler compiler = ToolProvider.getSystemJavaCompiler();
		DiagnosticCollector<JavaFileObject> diagnostics = new DiagnosticCollector<JavaFileObject>();
		StandardJavaFileManager fileManager = compiler.getStandardFileManager( diagnostics, null, null );
		Iterable<? extends JavaFileObject> units;
		units = fileManager.getJavaFileObjectsFromFiles( Arrays.asList( javaSrcFile ) );
		List<String> options = Arrays.asList(new String[]{"-cp", classPath});
		CompilationTask task = compiler.getTask( null, fileManager, diagnostics, options, null, units );
		task.call();		
		fileManager.close();
		
		String ret = "[";
		List<Diagnostic<? extends JavaFileObject>> diagnosticsList = diagnostics.getDiagnostics();
		for(int i = 0; i < diagnosticsList.size(); i++) {
			Diagnostic<? extends JavaFileObject> d = diagnosticsList.get(i);
			ret += "{";
			ret += "\"message\":" + "\"" + d.getMessage(null) + "\"" + ",";
			ret += "\"line\":" + "\"" + d.getLineNumber() + "\"" + ",";
			ret += "\"position\":" + "\"" + d.getColumnNumber() + "\"";
			ret += "}";
			ret += i+1 < diagnosticsList.size() ? "," : "";
		}
		ret += "]";
		
		os.println(ret);
		os.flush();
	}

	private void onError(BufferedReader ir, PrintWriter os) {
		// TODO Auto-generated method stub
		
	}

}
