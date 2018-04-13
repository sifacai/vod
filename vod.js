var http = require("http");
var url = require("url");
var fs = require("fs");
var pathh = require("path");
var qs = require("querystring");
var mimeTypes = require("./mime.json");
var videoMime = require("./videoMime.json")

var user="user";
var password="password";

//var root = "/srv/dev-disk-by-label-store/jp";
var root = "d:";  //根目录

var res; //response

http.createServer(function(req,ress){
	res=ress;
	
	var requrl = url.parse(req.url);
    var args = qs.parse(qs.unescape(requrl.query));	

	var pathname=qs.unescape(requrl.pathname);     //路径
	var cookies=req.headers.cookie;	
	
	if(cookies == undefined){                   //cookie检查
		var body="";
		if(req.method=="POST"){
			req.on("data",function(data){
				body += data;
			});

			req.on("end",function(){				
				body = qs.parse(body);
				console.log(body);
				if(body.user==user & password==body.password){
					body.password= md5(body.password);
					res.writeHead(200,{
										"Content-Type": "text/html" ,
										"Set-Cookie"  : ["user="+user,"password="+body.password]
										});

					res.end(htmlheader+"<script>window.location.reload();</script>"+htmlbottom);
				}else{
					res.end(htmlheader+"用户名或密码错误！"+htmlbottom);					
				}
			});
		}else{
			login("请登录！");
		}
		return;
	
	}else{
		cookies=qs.parse(cookies,"; ");
		if(user!=cookies.user){
			login("用户名错误！");			
			return;
		}
		if(md5(password)!=cookies.password){
			login("密码错误！");
			return;
		}
	}


	//播放视频
	if(args["name"]=="play"){              
		playhtml(args["filename"]);
		return;
	}

	var realpathname = "";

	switch(pathname){
		case "/folderimg":
			realpathname = "images/3.png";
			break;
		case "/css.css":
			realpathname = "css.css";
			break;
		case "/caomei/style.css":
			realpathname = "caomei/style.css";
			break;
		case "/caomei/fonts/strawberryicon.ttf":
			realpathname = "caomei/fonts/strawberryicon.ttf";
			break;
		case "/caomei/fonts/strawberryicon.woff":
			realpathname = "caomei/fonts/strawberryicon.woff";
			break;
		default:
			realpathname = root + pathname;
	}

	var pathstat = checkpathstat(realpathname);

	if(pathstat==undefined){
		outmiss("资源未找到!");
	}else{

		if(pathstat.isDirectory()){
			if(pathname != "/") realpathname += "/";
			readdir(realpathname);
		}else if(pathstat.isFile()){
			var ext = pathh.extname(realpathname);
			var mime = mimeTypes[ext.toLowerCase()];
			if(mime == undefined){
				outmiss("未知MIME类型！");
			}else{
				transFile(realpathname,mime,req.headers.range);				
			}
		}else{
			outmiss("未知目标类型！");
		}
	}

}).listen(3333);
console.log("开始运行，端口号：3333");

function readdir(path){	
	console.log("path is :"+path);
	fs.readdir(path,function(err,files){
		if(err){
			outmiss(path+"没有找到！页面丢失!");
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
				var div = "<p class='pitem'><a class='czs-folder-l' href='"+ path.replace(root,"") + file +"' >"+file+"</a></p><hr/>";
				res.write(div);
			});

			itemfiles.forEach(function(file){
				var div = "";
				if(videoMime[pathh.extname(file)]==undefined){
					//div = "<p class='pitem'><a class='czs-book' href='"+ path.replace(root,"") + file +"' >"+file+"</a></p><hr/>";					
				}else{
					div = videohtml(path.replace(root,""),file);
				}
				res.write(div);
			});
			res.end(htmlbottom);		
		}
		
	})
}

function videohtml(path,file){
	var jpg= path + file.replace(pathh.extname(file),".jpg");
	var div =   "<div class='videoDiv' >" +
				"<p><a href='?name=play&filename=" + path + file + "' ><h1>" + file + "</h1> </a> </p>" + 
				"<a href='" + jpg + "' ><img src='"+ jpg +"'  /> </a>" +
				"<li>电影名称：" + file + "</li>" +
				"<li>豆瓣评分：</li>" +
				"<li>年代：</li>" +
				"<li>类型：</li>" +
				"<li>主要演员：</li>" +
				"<li>简介：</li>" +
				"</div><hr/>";
	return div;
}

function playhtml(pathname){
	res.writeHead(200,{"Content-Type":"text/html"});
	res.write(htmlheader);
	res.write("<video src='"+pathname+"' controls='controls' width='100%' preload >您的需要更高级的浏览器。</video>");
	res.end(htmlbottom);
}

function topmenu(path){
	var div = "<ul class='topmenu'><li><a href='/'>首页</a></li>";
	var paths=path.split("/");
	var pp = "";
	paths.forEach(function(p){
		if(p != ""){
			pp = pp + "/" + p
			div += "<li><a href='"+ pp +"'>"+p+"</a></li>";
		}
		
	});
	div += "</ul><hr/>";
	return div;
}


function transFile(path,mime,range){
	realpath = path;	
	var stat = checkpathstat(realpath);
	
	var startPos;
	if(range==undefined){
		startPos = 0;
	}else{
		range = range.replace("bytes=","");
		startPos = Number(range.substr(0,range.indexOf("-")).trim());
	}

	console.log(startPos);
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
	console.log("开始传送：" + path );
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

function outmiss(txt){
	res.writeHead(404,{"Content-Type":"text/html;charset=utf8"});
	res.end(htmlheader+txt+htmlbottom);
}

function login(txt){
	var clearCookie =  "<script type=\"text/javascript\">" +
						"var keys=document.cookie.match(/[^ =;]+(?=\=)/g);" + 
						"if (keys) { " +
						"for (var i = keys.length; i--;) " +
						"document.cookie=keys[i]+'=0;expires=' + new Date( 0).toUTCString(); "+
						"} </script>" ;
	res.writeHead(200,{"Content-Type":"text/html"});
	res.write(htmlheader);
	res.write(clearCookie);
	res.write("<h1>"+txt+"</h1>");
	res.write(htmllogin);
	res.end(htmlbottom);
}

var htmlheader = "<html><head><meta http-equiv=\"Content-Type\" content=\"text/html; charset=utf-8\" />" +
				 "<meta name=\"viewport\" content=\"width=device-width\" />" +
				 "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0, minimum-scale=1.0, maximum-scale=1.0, user-scalable=no\" />" +	
			     "<link rel=\"stylesheet\" href=\"/css.css\" />" +
			     "<link rel=\"stylesheet\" href=\"/caomei/style.css\" />" +
			     "</head><body>";

var htmlbottom = "</body></html>";

var htmllogin = " <form method=\"post\" action=\"\" > " +
			    " <p>用户名: <input type=\"text\" name=\"user\" /></p> " +
			    " <p>密  码: <input type=\"password\" name=\"password\" /></p> " +
			    " <input type=\"submit\" value=\"提  交\" /> " +
			    " </form>" ;

var DirCss = "";//style=\"width:30%;float:left;background-color:yellow;border:1px solid black\"" ;
