package com.github.herrmano.javalanguageserver;

import javax.tools.SimpleJavaFileObject;
import java.io.IOException;
import java.io.OutputStream;
import java.net.URI;

/**
 * Created by oliverherrmann on 06.06.16.
 */
public class MemJavaFileObject extends SimpleJavaFileObject {

    OutputStream os = new OutputStream() {
        @Override public void write(int b) throws IOException {}
    };

    public MemJavaFileObject(String className) {
        super(URI.create("string:///" + className.replace( '.', '/' ) + Kind.CLASS.extension), Kind.CLASS );
    }

    @Override
    public OutputStream openOutputStream() throws IOException {
        return this.os;
    }
}
