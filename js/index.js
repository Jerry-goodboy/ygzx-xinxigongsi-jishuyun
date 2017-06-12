$(function () {
    // 所有的线路图层
    // var tucengAPI = "./all.json";
    var tucengAPI = "http://192.168.1.101:8080/psms/mapapi/loadLdColorInfo";

    // 基础地图二维底图
    var mapTileJCSJ = "http://10.128.101.221:6080/arcgis/rest/services/JCSJ/DX20170406/MapServer";

    // 基础地图影像底图
    var mapYX = "http://10.128.101.221:6080/arcgis/rest/services/JCSJ/YX20170406/MapServer";
    // 图层管理地图服务
    var mapQueryBaseUrl = "http://10.128.101.221:6080/arcgis/rest/services/SHJSY/SHJSY/MapServer";

    // 获取查询字符串的参数
    var query = location.search.substring(1);
    var values = query.split("&");
    var pos = values[0].indexOf('=');

    var queryRandom = values[0].substring(pos+1);

   function clearMapLayers(){
        // 移除地图上所有底图之外的图层
        map.eachLayer(function(_layer){
            if(_layer != layer){
                map.removeLayer(_layer);
            }
        });
    }

    // 每次换地图服务，必须修改下列参数，地图投影参考变换
    /* create new Proj4Leaflet CRS: */
    crs = new L.Proj.CRS("EPSG:TJ90", "+proj=tmerc +lat_0=0 +lon_0=117 +k=1 +x_0=82984.0462 +y_0=-4032478.47 +ellps=krass +units=m +no_defs", {
        origin: [-20015200, 30207300],
        resolutions: [
            66.1459656252646,
            26.458386250105836,
            13.229193125052918,
            5.291677250021167,
            2.6458386250105836,
            1.3229193125052918,
            0.5291677250021167,
            0.26458386250105836,
            0.13229193125052918
        ]
    });

    // 生成地图对象
    var map = L.map('map', {
        crs: crs,
        zoomControl: true,
        attributionControl: false
    }).setView([38.99, 117.79], 2);

    // 图层管理所显示的动态图层
    var dynamicMapLayer;
    // 图层管理高亮的线或者面图层
    var highlightGeometry;
    // 所有的线路图层
    var allRouteLayers;

    var allRoadIds = [];

    // 加载底图
    var layer = L.esri.tiledMapLayer({
        url: mapTileJCSJ,
        maxZoom: 7
    }).addTo(map);

    function showRoutes() {
        // 获取图层分组列表
        $.ajax({
            url: tucengAPI,
            dataType: "json",
            success: function (data) {
                allRoadIds = [];

                clearMapLayers();

                // 需要显示的图层ID
                var layersIDs = [];
                // 需要显示的图层ID和过滤条件
                var layersDefs = {};

                layersIDs.push(1);

                var queryStr = '';

                var colorObj = {};

                for (var i = 0; i < data.roadIds.length; i++) {
                    allRoadIds.push(data.roadIds[i]);

                    queryStr += "'";
                    queryStr += data.roadIds[i];
                    queryStr += "'";
                    queryStr += ",";
                    colorObj[data.roadIds[i]] = data.roadColors[i];
                }

                queryStr = queryStr.substr(0,queryStr.length - 1);

                layersDefs[layersIDs[0]] = "code IN (" + queryStr + ")";

                dynamicMapLayer = L.esri.dynamicMapLayer({
                    url: mapQueryBaseUrl,
                    opacity: 1,
                    layers: layersIDs,
                    layerDefs: layersDefs
                }).addTo(map);

                console.log(layersIDs);
                console.log(layersDefs);

                var url = mapQueryBaseUrl + "/1/query?where=";
                url += layersDefs[layersIDs[0]];
                url += "&text=&objectIds=&time=&geometry=&geometryType=esriGeometryEnvelope&inSR=&spatialRel=esriSpatialRelIntersects&relationParam=&outFields=*&returnGeometry=true&maxAllowableOffset=&geometryPrecision=&outSR=&returnIdsOnly=false&returnCountOnly=false&orderByFields=&groupByFieldsForStatistics=&outStatistics=&returnZ=false&returnM=false&gdbVersion=&returnDistinctValues=false&returnTrueCurves=false&resultOffset=&resultRecordCount=&f=pjson";

                $.ajax({
                    url: url,
                    dataType: "json",
                    success: function (data) {
                        // console.log(data);

                        var features = data["features"];

                        for (var j = 0; j < features.length; j++) {
                            var geoJSON = L.esri.Util.arcgisToGeoJSON(features[j]);
                            // console.log(geoJSON);

                            var geometryType = geoJSON["geometry"]["type"];
                            var rings = geoJSON["geometry"]["coordinates"];

                            // 根据点线面类型来进行判断执行坐标参考的转换
                            switch (geometryType) {
                                case "LineString":
                                    for (var i = 0; i < rings.length; i++) {
                                        var arcgisPoint = L.point(rings[i][0], rings[i][1]);
                                        var LatLngPoint = crs.unproject(arcgisPoint);
                                        geoJSON["geometry"]["coordinates"][i][0] = LatLngPoint.lng;
                                        geoJSON["geometry"]["coordinates"][i][1] = LatLngPoint.lat;
                                    }
                                    break;
                            }

                            var myStyle = {
                                "color": colorObj[geoJSON["properties"]["code"]],
                                "weight": 5,
                                "opacity": 0.85
                            };

                            allRouteLayers = L.geoJSON(geoJSON, {
                                style: myStyle
                            }).addTo(map);
                        }

                        map.setView([38.99, 117.79], 2);

                        // 为了保险起见，取消地图上所有的click事件
                        map.off("click");
                        // 监听地图上的click事件
                        map.on("click", function (e) {
                            // 将经纬度坐标点转换为T90坐标点
                            var T90Point = crs.project(e.latlng);

                            // 删除之前高亮的图层
                            if (highlightGeometry) {
                                map.removeLayer(highlightGeometry);
                            }

                            // 获取当前的地图边界，并转换为arcgis所识别的extend范围
                            var extent = boundsToExtent(map.getBounds());
                            // 返回当前地图容器的大小，单位为像素
                            var size = map.getSize();

                            // 将经纬度坐标点转换为T90坐标点
                            var maxArr = crs.project(L.latLng(extent.ymax, extent.xmax));
                            var minArr = crs.project(L.latLng(extent.ymin, extent.xmin));

                            // 构建请求arcgis rest API所需要的请求链接，该API用来识别鼠标选中的要素
                            var queryStr = "/identify?sr=53004&layers=visible:";
                            queryStr += layersIDs[0];
                            queryStr += "&tolerance=10&returnGeometry=true&imageDisplay=";
                            queryStr += size.x;
                            queryStr += ",";
                            queryStr += size.y;
                            queryStr += ",96&mapExtent=";
                            queryStr += minArr.x;
                            queryStr += ",";
                            queryStr += minArr.y;
                            queryStr += ",";
                            queryStr += maxArr.x;
                            queryStr += ",";
                            queryStr += maxArr.y;
                            queryStr += "&geometry=";
                            queryStr += T90Point.x;
                            queryStr += ",";
                            queryStr += T90Point.y;
                            queryStr += "&geometryType=esriGeometryPoint&f=json";

                            // 构建完整的请求地址
                            var queryStrUrl = mapQueryBaseUrl + queryStr;

                            //发送请求
                            $.ajax({
                                url: queryStrUrl,
                                dataType: "json",
                                success: function (data) {

                                    // 如果当前数据结果的长度大于0执行
                                    if (data["results"].length > 0) {
                                        var results = data["results"];

                                        for(var i = 0; i < results.length; i++){
                                            if($.inArray(results[i]["attributes"]["code"], allRoadIds) != -1) {
                                                // 将arcgis 地图格式 转换为 geoJSON的格式
                                                var geoJSON = L.esri.Util.arcgisToGeoJSON(results[i]);

                                                var geometryType = geoJSON["geometry"]["type"];
                                                var rings = geoJSON["geometry"]["coordinates"];
                                                var roadCode = geoJSON["properties"]["code"];

                                                // 根据点线面类型来进行判断执行坐标参考的转换
                                                switch (geometryType) {
                                                    case "LineString":
                                                        for (var i = 0; i < rings.length; i++) {
                                                            var arcgisPoint = L.point(rings[i][0], rings[i][1]);
                                                            var LatLngPoint = crs.unproject(arcgisPoint);
                                                            geoJSON["geometry"]["coordinates"][i][0] = LatLngPoint.lng;
                                                            geoJSON["geometry"]["coordinates"][i][1] = LatLngPoint.lat;
                                                        }
                                                        break;
                                                }

                                                // 根据点线面类型来生成对应的高亮图层
                                                switch (geometryType) {
                                                    case "LineString":

                                                        var myStyle = {
                                                            "color": "#3bfff2",
                                                            "weight": 5,
                                                            "opacity": 0.85
                                                        };

                                                        highlightGeometry = L.geoJSON(geoJSON, {
                                                            style: myStyle
                                                        }).addTo(map);
                                                        break;
                                                }

                                                console.log(geoJSON);

                                                socket.emit('gismap', {
                                                    sid: queryRandom,
                                                    command: "singleRoadId",
                                                    data: {
                                                        "roadId":roadCode
                                                    }
                                                });

                                                break;
                                            }
                                        }
                                    }
                                },
                                error: function (error) {
                                    console.log(error);
                                }
                            });

                            return false;
                        });

                    },
                    error: function (error) {
                        console.log(error);
                    }
                });
            },
            error: function (error) {
                console.log(error);
            }
        });
    }

    function showRoute(data) {
        // 获取图层分组列表
        clearMapLayers();

        // 需要显示的图层ID
        var layersIDs = [];
        // 需要显示的图层ID和过滤条件
        var layersDefs = {};

        layersIDs.push(1);

        var queryStr = '';

        var roadIdsArr = data.roadIds.split(",");

        for (var i = 0; i < data.roadIds.length; i++) {
            queryStr += "'";
            queryStr += roadIdsArr[i];
            queryStr += "'";
            queryStr += ",";
        }

        queryStr = queryStr.substr(0,queryStr.length - 1);

        layersDefs[layersIDs[0]] = "code IN (" + queryStr + ")";

        dynamicMapLayer = L.esri.dynamicMapLayer({
            url: mapQueryBaseUrl,
            opacity: 1,
            layers: layersIDs,
            layerDefs: layersDefs
        }).addTo(map);

        var dotsDefs = "code IN ('" + data["routeStart"]["code"] + "','" + data["routeEnd"]["code"] + "')";

        var url = mapQueryBaseUrl + "/0/query?where=";
        url += dotsDefs;
        url += "&text=&objectIds=&time=&geometry=&geometryType=esriGeometryEnvelope&inSR=&spatialRel=esriSpatialRelIntersects&relationParam=&outFields=*&returnGeometry=true&maxAllowableOffset=&geometryPrecision=&outSR=&returnIdsOnly=false&returnCountOnly=false&orderByFields=&groupByFieldsForStatistics=&outStatistics=&returnZ=false&returnM=false&gdbVersion=&returnDistinctValues=false&returnTrueCurves=false&resultOffset=&resultRecordCount=&f=pjson";

        $.ajax({
            url: url,
            dataType: "json",
            success: function (data) {
                console.log(data);

                var features = data["features"];

                for (var j = 0; j < features.length; j++) {
                    var geoJSON = L.esri.Util.arcgisToGeoJSON(features[j]);
                    // console.log(geoJSON);

                    var geometryType = geoJSON["geometry"]["type"];
                    var rings = geoJSON["geometry"]["coordinates"];

                    // 根据点线面类型来进行判断执行坐标参考的转换
                    switch (geometryType) {
                        case "Point":
                            var arcgisPoint = L.point(rings[0], rings[1]);
                            var LatLngPoint = crs.unproject(arcgisPoint);
                            geoJSON["geometry"]["coordinates"][0] = LatLngPoint.lng;
                            geoJSON["geometry"]["coordinates"][1] = LatLngPoint.lat;
                            L.marker([
                                geoJSON["geometry"]["coordinates"][1],
                                geoJSON["geometry"]["coordinates"][0]
                            ]).addTo(map);
                            break;
                    }
                }

                // 为了保险起见，取消地图上所有的click事件
                map.off("click");

            },
            error: function (error) {
                console.log(error);
            }
        });
    }

    // convert an LatLngBounds (Leaflet) to extent (ArcGIS)
    function boundsToExtent(bounds) {
        bounds = L.latLngBounds(bounds);
        return {
            'xmin': bounds.getSouthWest().lng,
            'ymin': bounds.getSouthWest().lat,
            'xmax': bounds.getNorthEast().lng,
            'ymax': bounds.getNorthEast().lat,
            'spatialReference': {
                'wkid': 4326
            }
        };
    }

    showRoutes();

    var socket = io("http://192.168.1.103:3333");

    socket.on('connect', function(msg){
        console.log(msg);
        // var date = new Date();

        // socket.emit('token', date.getTime());
        // socket.emit('singleRoad', 'world');
    });

    // socket.on('singleRoute', function(msg){
    //     console.log(msg);
    //     if(msg.status == "success"){
    //         showRoute(msg);
    //     }
    // });

    // socket.on('allRoutes', function(msg){
    //     console.log(msg);
    //     if(msg.status == "success"){
    //         showRoutes();
    //     }
    // });

    socket.on('gis', function(msg){
        if(queryRandom == msg.sid){
            switch (msg.command) {
                case "singleRoute":
                    console.log(msg);
                    showRoute(msg.data);
                    break;
                case "allRoutes":
                    showRoutes();
                    break;
                case "searchComYard":
                    searchComYard();
                    // {
                    //     "ComCode":121,
                    //     "YardCode":233
                    // }
                    break;
            }
        }
    });

    // setTimeout(function () {
    //     socket.emit('gismap', {
    //         sid: 123,
    //         command: "singleRoute",
    //         data: {
    //             "status": "success",
    //             "routeStart": {
    //                 "code": 201,
    //                 "name": "码头"
    //             },
    //             "routeEnd": {
    //                 "code": 202,
    //                 "name": "货场"
    //             },
    //             "roadIds": ["1001", "1002"]
    //         }
    //     });
    // }, 3000);
    


});
