var fs = require("fs");
var http = require("http");
var qs = require("querystring");
var url = require("url");
var events = require("events");
var mimeTypes = require("./mime.json");
var videoMime = require("./videoMime.json");
var config = require("./config.json");

var root = config["root"];

try{
	if(!CheckStat(root).isDirectory()){
		console.log("请设置ROOT目录");
		process.exit();
	}
}catch(err){
	console.log(err);
	process.exit();
}

var handler = new events.EventEmitter();

var server = http.createServer(function(req,res){
	var requrl = url.parse(req.url);
	var pathname = qs.unescape(requrl.pathname);
	var args = requrl.query;
	var cookies = req.headers.cookie;

	if(args == null){
		handler.emit("miss",res);
		return;
	}

	args = qs.parse(qs.unescape(args));

	console.log(args);

	var action = args["action"];
	var folder = args["folder"];
	var filename = args["filename"];

	console.log("action is: "+action);
	console.log("folder is: "+folder);
	console.log("filename is: "+filename);

	switch(action){
		case "list":
			ReadDir(folder,res);
			break;		
		case "play":

			break;
		default:
			handler.emit("miss",res);
			break;
	}
	//if(req.headers.range == undefined)

	
});
server.listen(3333);

function ReadDir(path,res){	
	var realpath = root + path;
	console.log("path is :"+ realpath);

	var stat = CheckStat(realpath);
	if(stat == null){
		handler.emit("miss",res);
	}else{
		fs.readdir(realpath,function(err,files){
			if(err){
				handler.emit("miss",res);
			}else{
				res.writeHead(200,{"Content-Type":"text/html;charset=utf8"});
				var itemfolders = [];
				var itemfiles = [];

				files.forEach(function(file){
					try{
						var filestat = CheckStat( realpath +"/"+ file );
						if(filestat.isDirectory()) itemfolders.push(file);
						else itemfiles.push(file);
					}catch(err){
						console.log(err);
					}
					
				})	

				var div="";
				itemfolders.forEach(function(file){
					div += "<p class='pitem'><a href='?action=folder&folder="+ realpath.replace(root,"") + "/" + file +"' >"+file+"</a></p><hr/>";
				});

				itemfiles.forEach(function(file){
					div += "<p class='pitem'><a href='?action=play&filename="+ realpath.replace(root,"") + "/" + file +"' >"+file+"</a></p><hr/>";					
				});
				
				res.end(html.replace("$body$",div));
			}
		});
	}

	
		
			

		
}

function TransFile(FileName,res){
	var realpath = root+FileName;

	vat filestat = CheckStat(realpath);
	var LastModified = filestat.mtime ;
	var etag = md5(realpath+LastModified);


	var extname = FileName.substr(FileName.indexOf("."));
	var mime = mimeTypes[extname];

	if(mime == undefined) mime = "application/octet-stream";

	var statucode = 200;
	var startPos = 0;
	var range = req.headers.range;
	if(range != undefined ){
		range = range.replace("bytes=","");
		range = substr(0,range.indexOf("-")).trim();
		startPos = Number(range);
		statucode = 206;
	}

	res.writeHead(statucode,{ 
							"Content-Type" : mime ,
							"Content-Range" : "bytes "+ startPos + "-" + (stat.size-1) + "/" + stat.size ,
							"Content-Length" : stat.size-startPos ,
							"Etag" : etag , 
							"Last-Modified"  : LastModified.toUTCString()
						});
	


	var realpath = root+FileName;
	var readstream = fs.createReadStream(realpath,{ flags: "r",start: startPos, end: stat.size });
	readstream.pipe(res);
}

function CheckStat(pathname){
	var stat = null;
	try{
		stat=fs.statSync(pathname);
	}catch(err){
		console.log(err);
	}
	return stat;
}

function md5(txt){
	var crypto=require('crypto');  
	var md5=crypto.createHash("md5");  
	md5.update(txt);  
	var str=md5.digest('hex');  
	return str.toUpperCase();
}

handler.on("miss",function(res){
	res.end(html.replace("$body$","目标没有找到!"));
});

var html = "<html><head>$head$</head><body>$body$</body></html>";