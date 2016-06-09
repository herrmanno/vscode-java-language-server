package com.github.herrmano.javalanguageserver;

import java.io.IOException;
import java.net.BindException;
import java.net.UnknownHostException;

public class Main {
	
	public static void main(String[] args) {
		int port = 56789;
		if(args.length >= 2) {
			port = Integer.parseInt(args[1]);
		}

		try {
			Server server = new Server();
			server.start(port);
		} catch(BindException e) {
			System.out.println("PORT_USED");
			System.err.println("Error while starting Java-Language-Server.\nPort " + port + " seems to be already in use.");
			System.exit(1);
		} catch(IOException e) {
			System.err.println("Error while starting Java-Language-Server.\nAn IOException occured.");
			System.exit(2);
		}
	}
}
