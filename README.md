# OotModLoader
A modloader for Ocarina of Time 1.0. Includes OotOnline.

## Building from the source

### Apache Ant
To build the program from the source, you will need to have [Apache Ant](https://ant.apache.org/bindownload.cgi). 

### Java
To build the program from the source, you will need to have [Java](https://www.java.com/en/) installed.

### BizHawk Emulator
To include BizHawk with your build, add (these)[] files to the bizhawk_dist Sub-Directory _(See below)_

### Sub-Directories
In the root directory of the repository, you need to create child directories with the names _mods_, _rom_, _bizhawk_dist_.
This can be quickly done by running the command 
```shell
mkdir mods rom bizhawk_dist
```

### Building the program
To build the program, you simply need to call the ant executable _(Apache-Ant\bin\ant)_ with the current directory being the root of the repository.

Alternativley, you can use the _build.bat_ file.

#### Using build.bat
To use the file _build.bat_, you need to change the directory in the line which reads
```shell
call apache-ant-1.10.5\bin\ant
```
to the directory of your download of Apache Ant followed by `\bin\ant`
For example, if the Apache Ant directory is `C:\Stuff\Apache-Ant` the line would read 
```shell
call C:\Stuff\Apache-Ant\bin\ant
```

Following this, simply run the file!



