var https = require("https");
var fs = require("fs");
var qs =  require("querystring");
var config = require("./config.json");
var cheerio = require('cheerio');

//var MovieFileName;
var MovieFileJson;
var movieinfofile = config["movieinfofile"];

var cover = config["cover"];

function searchMovie(moviename,MovieJson){
	var MovieFileName = moviename;
	MovieFileJson = MovieJson;

	var searchUrl = "https://movie.douban.com/j/subject_suggest?q=" + qs.escape(moviename);
	console.log("开始处理："+ moviename + " 请求地址是："+ searchUrl);
	
	var resdata="";
	https.get(searchUrl,function(res){
		if(res.statusCode == 200){
			res.on("data",function(data){
				resdata+=data;
			});
			res.on("end",function(){
				getMovieHtml(moviename,resdata);
				console.log(MovieFileName+"搜索完成");
				console.log(resdata);
			});
		}else{
			console.log(MovieFileName+"搜索失败！");
		}

	});
}

function getMovieHtml(moviename,data){
	data = JSON.parse(data);
	console.log(moviename+"搜索到:"+data.length+"条数据");
	if(data.length<1) return;
	var target = data[0].url;

	var resdata = "";
	https.get(target,function(res){
		if(res.statusCode == 200){
			res.on("data",function(data){
				resdata+=data;
			});
			res.on("end",function(){
				queryFileHtml(moviename,resdata);
			});
		}else{
			console.log(moviename+"获取正文失败");
		}

	});
}

function queryFileHtml(moviename,HtmlData){
	var movieinfo ={};

	var allhtml = cheerio.load(HtmlData);

	var summary = allhtml('#link-report').text().trim();  //剧情简介	
	summary = summary.replace("\n","");
	
	movieinfo.summary =  summary;

	var rating = allhtml('.rating_num','.rating_self').text();  //豆瓣评分
	
	movieinfo.rating =rating;

	var pic = allhtml("img","#mainpic").attr('src');  //封面

	movieinfo.piclink = pic;

	var resdata = "";
	var picExtname = pic.substr(pic.lastIndexOf("."));

	movieinfo.picfilename = moviename + picExtname;

	https.get(pic,function(res){
		res.setEncoding("binary");
		if(res.statusCode==200){
					
			res.on("data",function(data){
				resdata+=data;
			});
			res.on("end",function(){
				fs.writeFileSync( cover + moviename + picExtname , resdata, "binary" );
				console.log(moviename+"封面保存成功!");
			});
		}else{
			console.log(moviename+"封面获取失败!");
		}

	});

	var filminfo = allhtml('#info').text().split("\n");         //电影详情
    var info = filminfo.filter(function(item){
    	return item.trim() != "" ;
    });

	info.forEach(function(elem,i){
		info[i] = elem.trim();
	});

	movieinfo.filminfo = info;
	
	MovieFileJson[moviename] = movieinfo;

	saveFilminfo(moviename);
}

function saveFilminfo(moviename){
	fs.writeFileSync( movieinfofile, JSON.stringify(MovieFileJson) );
	console.log(moviename+"电影信息保存成功");
}

module.exports = searchMovie;