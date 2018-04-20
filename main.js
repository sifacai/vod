var fs = require("fs");
var http = require("http");
var qs = require("querystring");
var url = require("url");
var events = require("events");
var reptile = require("./reptile");
var mimeTypes = require("./mime.json");
var videoMime = require("./videoMime.json");
var config = require("./config.json");

var MovieInfoJson = require(config["movieinfofile"]);

var root = config["root"];
var coverroot = config["cover"]; //封面目录
var Server = config["Server"];
console.log(Server);

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
			playhtml(filename,res);
			break;
		case "file":
			TransFile(filename,res,req);
			break;
		default:
			handler.emit("miss",res,"请检查路径！");
			break;
	}

	
});
server.listen(3333);

function ReadDir(path,res){	
	var realpath = root + path;
	var stat = CheckStat(realpath);
	if(stat == null){
		handler.emit("miss",res,"目标读取错误！");
		return;
	}else{
		fs.readdir(realpath,function(err,files){
			if(err){
				handler.emit("miss",res,"目录列表错误！");
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
					div += "<p class='pitem'><a href='?action=list&folder="+ realpath.replace(root,"") + "/" + file +"' >"+file+"</a></p><hr/>";
				});

				itemfiles.forEach(function(file){
					var pos = file.lastIndexOf(".");
					var basename = file;
					if(pos > 0){
						basename = file.substr(0,pos);
					}
					var extname = file.substr(pos);
					var mime = videoMime[extname];
					if(mime != undefined){
						div += videohtml(basename).replace("$MovieHref$",realpath.replace(root,"") + "/" + file);
						//div += "<p class='pitem'><a href='?action=play&filename="+ realpath.replace(root,"") + "/" + file +"' >"+file+"</a></p><hr/>";					
					}
				});
				
				res.end(html.replace("$body$",div));
			}
		});
	}
		
}

function playhtml(pathname,res,req){
	var src = "?action=file&filename=" + pathname;
	var videohtml= "<video src='" + src + "' controls='controls' preload >您需要更高级的浏览器。</video>"
	res.writeHead(200,{"Content-Type":"text/html"});
	res.end(html.replace("$body$",videohtml));
}

function videohtml(basename){

	var movieinfo = MovieInfoJson[basename];
	var cover = "cover.jpg";
	var dbinfo = [];
	var rating = "";
	var summary = "";

	if( movieinfo == undefined ){
		var searchMovie = new reptile(basename,MovieInfoJson);
	}else if( movieinfo != "" ){
		cover = movieinfo["picfilename"];
		dbinfo = movieinfo["filminfo"];
		rating = movieinfo["rating"];
		summary = movieinfo["summary"];
	}else{
		dbinfo[0] = "没有资料！";
		summary = "没有简介" ;
	}

	var div =   "<div class='videoDiv' >" +
				"<p><a href='?action=play&filename=$MovieHref$' ><h1>" + basename + "</h1><i>豆瓣评分："+rating+"</i> </a> </p>" + 
				"<a href='?action=play&filename=" + movieinfo + "' ><img src='?action=file&filename="+ coverroot+ "/" +cover +"'  /> </a>" ;

	dbinfo.forEach(function(item,i){
		div += "<li>"+ item.trim() + "</li>";
	});
	
	div += "<li>简介：" + summary + "</li></div><hr/>" ;

	return div;
}

function TransFile(FileName,res,req){
	var realpath = root+FileName;

	var filestat = CheckStat(realpath);
	if(filestat == null){
		handler.emit("miss",res,"文件无法读取！");
		console.log(realpath+" 出错！");
		return;
	}
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
		range = range.substr(0,range.indexOf("-")).trim();
		startPos = Number(range);
		statucode = 206;
	}

	res.writeHead(statucode,{ 
							"Server" : Server,
							"Content-Type" : mime ,
							"Content-Range" : "bytes "+ startPos + "-" + (filestat.size-1) + "/" + filestat.size ,
							"Content-Length" : filestat.size-startPos ,
							"Etag" : etag , 
							"Last-Modified"  : LastModified.toUTCString()
						});

	var readstream = fs.createReadStream(realpath,{ flags: "r",start: startPos, end: (filestat.size-1) });
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

handler.on("miss",function(res,txt){
	res.end(html.replace("$body$",txt));
});

var html = "<html><head><meta http-equiv=\"Content-Type\" content=\"text/html; charset=utf-8\" />"+
		   "<link rel=\"stylesheet\" href=\"?action=file&filename=/css.css\" />" +	
		   "<script type='text/javascript' src='/js.js' ></script>" +
		   "</head><body>$body$</body></html>";