package com.github.herrmano.javalanguageserver;

import javax.tools.JavaFileObject;
import javax.tools.SimpleJavaFileObject;
import java.io.IOException;
import java.net.URI;

/**
 * Created by oliverherrmann on 06.06.16.
 */
public class StringJavaFileObject extends SimpleJavaFileObject {

    private String code;
    private String name;

    /**
     * Construct a SimpleJavaFileObject of the given kind and with the
     * given URI.
     *
     * @param name  the class's name
     * @param code the class's source code
     */
    protected StringJavaFileObject(String name, String code) {
        super(URI.create("string:///" + name.replace(".java", "").replace( '.', '/' ) + Kind.SOURCE.extension), Kind.SOURCE);
        this.code = code;
    }

    @Override
    public CharSequence getCharContent(boolean ignoreEncodingErrors) throws IOException {
        return this.code;
    }
}
