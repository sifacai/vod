var https = require("https");
var fs = require("fs");
var qs =  require("querystring");
var config = require("./config.json");

var MovieFileName;
var MovieFileJson;
var movieinfofile = config["movieinfofile"];

var cover = config["cover"];

exports.searchMovie = function(moviename,MovieJson){
	MovieFileName = moviename;
	MovieFileJson = MovieJson;

	var searchUrl = "https://movie.douban.com/j/subject_suggest?q=" + qs.escape(name);
	
	var resdata="";
	https.get(searchUrl,function(res){
		if(res.statusCode == 200){
			res.on("data",function(data){
				resdata+=data;
			});
			res.on("end",function(){
				getMovieHtml(resdata);
			});
		}
	});
}

function getMovieHtml(data){
	data = JSON.parse(data);
	if(data.length<1) return;
	var target = data[0].url;

	var resdata = "";
	https.get(target,function(res){
		if(res.statusCode == 200){
			res.on("data",function(data){
				resdata+=data;
			});
			res.on("end",function(){
				queryFileHtml(resdata);
			});
		}
	});
}

function queryFileHtml(HtmlData){
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

	movieinfo.picfilename = MovieFileName + picExtname;

	https.get(pic,function(res){
		if(res.statusCode){
			res.setEncoding("binary");		
			res.on("data",function(data){
				resdata+=data;
			});
			res.on("end",function(){
				fs.writeFileSync( cover + MovieFileName + picExtname , resdata, "binary" );
			});
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
	
	MovieFileJson[MovieFileName] = movieinfo;

	saveFilminfo(MovieFileJson);
}

function saveFilminfo(){
	fs.writeFileSync( movieinfofile, JSON.stringify(MovieFileJson) );
}