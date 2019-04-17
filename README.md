# OotModLoader

This is a system for loading mods in Ocarina of Time 1.0.

## Features
- Load romhacks without manually applying patches
- Load plugins that interact with the game RAM during runtime.
- Networked by default: Everything is made with multiplayer in mind.

### OotOnline
OotOnline comes bundled with the ModLoader as the first plugin created for it. This plugin gives you the ability to share your Ocarina of Time experience with friends. See your friends in the game world, share items and quest progress with them, and push them off ledges as you progress through this timeless classic together.

##### Installation instructions
Download the latest release from our [releases](https://github.com/hylian-modding/OotModLoader/releases "releases") page. Unzip it and run the executable. You need an The Legend of Zelda: Ocarina of Time 1.0 NTSC English or Japanese rom in the ./rom folder in order to play. Team OotO nor its Discord will provide you with any information as to how to obtain this.

##### Build instructions for developers
- Download [Apache Ant](https://ant.apache.org/ "Apache Ant"). This requires [Java](https://www.java.com/en/ "Java").
- Unzip Ant into a folder named ant at the project root.
- Install [Node](https://nodejs.org/en/ "Node").
- Download [BizHawk](http://tasvideos.org/BizHawk/ReleaseHistory.html "BizHawk").
- Unzip BizHawk into a folder named bizhawk_dist in the project root. The folder structure should look like ./bizhawk_dist/BizHawk/EmuHawk.exe.
- Invoke Ant via command line or through build.bat.