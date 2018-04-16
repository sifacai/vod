var fs = require("fs");
var http = require("http");
var qs = require("querystring");
var config = require("./config.json");


function router(args) {

	var action = args["action"];
	var folder = args["folder"];
	var filename = args["filename"];

	switch(action){
		case "file":
			TransFile(,mime,filename);
			break;
		case "folder":
			ReadDir(folder);
			break;
		case "play":
			break;
	}

	return true;
}


function TransFile(statusCode,Mime,FileName){
	
}