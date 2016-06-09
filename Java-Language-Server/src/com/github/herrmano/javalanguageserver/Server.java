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

import javax.tools.*;
import javax.tools.JavaCompiler.CompilationTask;

public class Server {
	
	private ServerSocket socket;
	private JavaCompiler compiler;
	private boolean abort = false;
	//private Path tmpDir;
	private String classPath = "";
	
	public void start(int port) throws IOException {
		this.compiler = ToolProvider.getSystemJavaCompiler();
		if(null == this.compiler)
			System.out.println("No Compiler found! Please specify JDK location");
		
		this.socket = new ServerSocket(port);
		//this.tmpDir = Files.createTempDirectory("java-languageserver");
		System.out.println("RUNNING");
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
		String method = header.split("\t")[0];
		
		switch (method) {
		case "LINT":
			String className = header.split("\t")[1];
			this.onLint(ir, os, className);
			break;
		case "SET":
			String property = header.split("\t")[1];
			switch(property) {
				case "CLASSPATH":
					this.classPath  = header.split("\t")[2];
					break;
				case "JDK":
					String jdkHome = header.split("\t")[2];
					System.setProperty("java.home", jdkHome);
					this.compiler = ToolProvider.getSystemJavaCompiler();
					if(null == this.compiler)
						System.out.println("Wrong JDK Path");
			}
			break;
		case "KILL":
			System.exit(0);
			break;
		default:
			this.onError(ir, os);
			break;
		}
	}

	private void onLint(BufferedReader ir, PrintWriter os, String className) throws Exception {
		String classString = "";
		String line;
		do {
			line = ir.readLine();
			classString += line.equals("END") ? "" : (line + "\n");
		} while(!line.equals("END"));


		StringJavaFileObject javaSrcFile = new StringJavaFileObject(className, classString);
		//------- Write class to temp file
		//File javaSrcFile = this.tmpDir.resolve(className).toFile();
		//Writer p = new FileWriter( javaSrcFile );
		//p.write( classString );
		//p.close();
		
		//------ Compile via API
		DiagnosticCollector<JavaFileObject> diagnostics = new DiagnosticCollector<JavaFileObject>();
		JavaFileManager fileManager = new MemJavaFileManager(compiler);
		//StandardJavaFileManager fileManager = compiler.getStandardFileManager( diagnostics, null, null );
		Iterable<? extends JavaFileObject> units;
		units = Arrays.asList(javaSrcFile);
		//List<String> options = Arrays.asList(new String[]{"-cp", classPath, "-d", tmpDir.toAbsolutePath().toString()});
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
			ret += "\"position\":" + "\"" + d.getColumnNumber() + "\"" + ",";
			ret += "\"type\":" + "\"" + d.getKind() + "\"";
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
