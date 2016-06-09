package com.github.herrmano.javalanguageserver;

import javax.tools.*;

/**
 * Created by oliverherrmann on 06.06.16.
 */
public class MemJavaFileManager extends ForwardingJavaFileManager<StandardJavaFileManager> {

    public MemJavaFileManager(JavaCompiler compiler) {
        super( compiler.getStandardFileManager( null, null, null ) );
    }

    @Override
    public JavaFileObject getJavaFileForOutput(Location location, String className, JavaFileObject.Kind kind, FileObject sibling ) {
        MemJavaFileObject fileObject = new MemJavaFileObject(className);
        return fileObject;
    }
}
