package com.github.herrmano.javalanguageserver;

import java.io.IOException;
import java.net.UnknownHostException;

public class Main {
	
	public static void main(String[] args) throws UnknownHostException, IOException {
		int port = 56789;
		if(args.length >= 2) {
			port = Integer.parseInt(args[1]);
		}
		
		Server server = new Server();
		server.start(port);
	}
}
