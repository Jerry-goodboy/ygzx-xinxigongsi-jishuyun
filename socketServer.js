// var express = require('express');
// var app = express();
// var http = require('http').Server(app);
// var io = require('socket.io')(http);
// var fs = require('fs');

var Server = require('socket.io');
var io = new Server(3333);

var token;



io.on('connection', function (socket) {
    console.log('socket port 3333 is connected');

  //   setTimeout(function () {
  //       io.emit('singleRoute', {
		//     "status": "success",
		//     "routeStart": {
		//         "code": 201,
		//         "name": "码头"
		//     },
		//     "routeEnd": {
		//         "code": 202,
		//         "name": "货场"
		//     },
		//     "roadIds": ["1001", "1002"]
		// });
  //   }, 3000);

  //   setTimeout(function () {
  //       io.emit('allRoutes', {
  //         	"status": "success",
  //       	"command": "getAllRoutes"
  //     	});
  //   }, 6000);

    // socket.on('singleRoad', function(msg){
    //     console.log(msg);
    // });

    // socket.on('singleRoad', function(msg){
    //     console.log(msg);
    //     io.emit('singleRoadId', msg);
    // });

    socket.on('gismap', function(msg){
        
        console.log(msg);
        io.emit('gis', msg);
    });

    socket.on('disconnect', function(){
        console.log('user disconnected');
    });

});



