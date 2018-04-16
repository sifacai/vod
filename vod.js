var http = require("http");
var url = require("url");
var fs = require("fs");
var pathh = require("path");
var qs = require("querystring");
var mimeTypes = require("./mime.json");
var videoMime = require("./videoMime.json");
var reptile = require("./reptile");
var config = require("./config.json");

var MovieInfoJson = require(config["movieinfofile"]);


var user="user";
var password="password";

var root = config["root"];  //根目录
var coverroot = config["cover"]; //封面目录


http.createServer(function(req,res){	
	
	var requrl = url.parse(req.url);
    var args = qs.parse(qs.unescape(requrl.query));	

	var pathname=qs.unescape(requrl.pathname);     //路径
	var cookies=req.headers.cookie;	
	

	//cookie检查	
	if(req.method=="POST"){
		var postdata="";
		req.on("data",function(data){
			postdata += data;
		});

		req.on("end",function(){				
			postdata = qs.parse(postdata);
			console.log(postdata);
			if(postdata.user==user & password==postdata.password){
				console.log(req.connection.remoteAddress + "登录成功!");
				postdata.password= md5(postdata.password);
				res.writeHead(200,{
									"Content-Type": "text/html" ,
									"Set-Cookie"  : ["user="+user,"password="+postdata.password]
									});

				res.end(htmlheader+"<script>window.location.href='';</script>"+htmlbottom);
			}else{
				res.end(htmlheader+"用户名或密码错误！"+htmlbottom);					
			}
		});
		return;
	}

	cookies=qs.parse(cookies,"; ");
	if(user!=cookies.user){
		login("用户名错误！",res);			
		return;
	}
	if(md5(password)!=cookies.password){
		login("密码错误！",res);
		return;
	}

	//播放视频
	if(args["name"]=="play"){              
		playhtml(args["filename"],res);
		return;
	}

	if(args["name"]=="pic"){
		var picn = args["filename"];
		transFile(coverroot+picn,mimeTypes[pathh.extname(picn).toLowerCase()],undefined,res);
		return;
	}

	var realpathname = "";

	switch(pathname){
		
		case "/css.css":
			realpathname = "css.css";
			break;
		case "/js.js":
			realpathname = "js.js";
			break;
		default:
			realpathname = root + pathname;
	}

	var pathstat = checkpathstat(realpathname);

	if(pathstat==undefined){
		outmiss("资源未找到!",res);
	}else{

		if(pathstat.isDirectory()){
			if(pathname != "/") realpathname += "/";
			readdir(realpathname,res);
		}else if(pathstat.isFile()){
			var ext = pathh.extname(realpathname);
			var mime = mimeTypes[ext.toLowerCase()];
			if(mime == undefined){
				outmiss("未知MIME类型！",res);
			}else{
				transFile(realpathname,mime,req.headers.range,res);				
			}
		}else{
			outmiss("未知目标类型！",res);
		}
	}

}).listen(3333);
console.log("开始运行，端口号：3333");

function readdir(path,res){	
	console.log("path is :"+path);
	fs.readdir(path,function(err,files){
		if(err){
			outmiss(path+"没有找到！页面丢失!",res);
		}else{
			res.writeHead(200,{"Content-Type":"text/html;charset=utf8"});
			res.write(htmlheader)
			res.write(topmenu(path.replace(root,"")));
			var itemfolders = [];
			var itemfiles = [];

			files.forEach(function(file){
				try{
					var filestat = fs.statSync( path + file );
					if(filestat.isDirectory()) itemfolders.push(file);
					else itemfiles.push(file);
				}catch(err){
					console.log(err);
				}
				
			})	

			itemfolders.forEach(function(file){
				var div = "<p class='pitem'><a href='"+ path.replace(root,"") + file +"' >"+file+"</a></p><hr/>";
				res.write(div);
			});

			itemfiles.forEach(function(file){
				var div = "";
				if(videoMime[pathh.extname(file)]==undefined){
					//div = "<p><a href='"+ path.replace(root,"") + file +"' >"+file+"</a></p><hr/>";					
				}else{
					div = videohtml(path.replace(root,""),file);
				}
				res.write(div);
			});
			res.end(htmlbottom);		
		}
		
	})
}

function transFile(path,mime,range,res){
	realpath = path;	
	var stat = checkpathstat(realpath);

	if(stat == undefined){
		outmiss("目标没找到！");
		return;
	}
	
	var startPos;
	if(range==undefined){
		startPos = 0;
	}else{
		range = range.replace("bytes=","");
		startPos = Number(range.substr(0,range.indexOf("-")).trim());
	}

	var LastModified = stat.mtime ;
	var etag = md5(realpath+LastModified);

	var htmlstat = 206;

	if(videoMime[pathh.extname(path)]==undefined) htmlstat = 200;
	
	res.writeHead(htmlstat,{ 
							"Content-Type" : mime ,
							"Content-Range" : "bytes "+ startPos + "-" + (stat.size-1) + "/" + stat.size ,
							"Content-Length" : stat.size-startPos ,
							"Etag" : etag , 
							"Last-Modified"  : LastModified.toUTCString()
						});
	
	var readstream = fs.createReadStream(realpath,{ flags: "r",start: startPos, end: stat.size });	
	readstream.pipe(res);
}

function md5(txt){
	var crypto=require('crypto');  
	var md5=crypto.createHash("md5");  
	md5.update(txt);  
	var str=md5.digest('hex');  
	return str.toUpperCase();
}

function checkpathstat(path){
	var stat;
	try{
		stat=fs.statSync(path);
	}catch(err){
		console.log(err);
	}
	return stat;	
}

function outmiss(txt,res){
	res.writeHead(404,{"Content-Type":"text/html;charset=utf8"});
	res.end(htmlheader+txt+htmlbottom);
}

function login(txt,res){	
	res.writeHead(200,{"Content-Type":"text/html"});
	res.write(htmlheader);
	res.write("<h1>"+txt+"</h1>");
	res.write(htmllogin);
	res.end(htmlbottom);
}

function videohtml(path,file){
	var basename = pathh.basename(file,pathh.extname(file));

	var movieinfo = MovieInfoJson[basename];

	var moviehref = path + file;
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
				"<p><a href='?name=play&filename=" + moviehref + "' ><h1>" + basename + "</h1><i>豆瓣评分："+rating+"</i> </a> </p>" + 
				"<a href='?name=pic&filename=" + cover + "' ><img src='?name=pic&filename="+ cover +"'  /> </a>" ;

	dbinfo.forEach(function(item,i){
		div += "<li>"+ item.trim() + "</li>";
	});
	
	div += "<li>简介：" + summary + "</li></div><hr/>" ;

	return div;
}

function playhtml(pathname,res){
	res.writeHead(200,{"Content-Type":"text/html"});
	res.write(htmlheader);
	res.write("<video src='"+pathname+"' controls='controls' preload >您需要更高级的浏览器。</video>");
	res.end(htmlbottom);
}

function topmenu(path){
	var div = "<p class='topmenu'><i><a href='/'>首页</a></i>";
	var paths=path.split("/");
	var pp = "";
	paths.forEach(function(p){
		if(p != ""){
			pp = pp + "/" + p
			div += "<i><a href='"+ pp +"'>"+p+"</a></i>";
		}
		
	});
	div += "</p><hr/>";
	return div;
}



var htmlheader = "<html><head><meta http-equiv=\"Content-Type\" content=\"text/html; charset=utf-8\" />" +
				 "<meta name=\"viewport\" content=\"width=device-width\" />" +
				 "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0, minimum-scale=1.0, maximum-scale=1.0, user-scalable=no\" />" +	
			     "<link rel=\"stylesheet\" href=\"/css.css\" />" +	
			     "<script type='text/javascript' src='/js.js' ></script>" +	     
			     "</head><body>";

var htmlbottom = "</body></html>";

var htmllogin = " <form method=\"post\" action=\"\" > " +
			    " <p>用户名: <input type=\"text\" name=\"user\" /></p> " +
			    " <p>密  码: <input type=\"password\" name=\"password\" /></p> " +
			    " <input type=\"submit\" value=\"提  交\" /> " +
			    " </form>" ;
