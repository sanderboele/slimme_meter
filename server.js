#!/usr/bin/nodejs

/*
This is the server that can dynamically create RRD images served via http.
Images are stored in /ramcache, this speeds up the process. I tried binary but couldn't figure that out.
*/

fs = require('fs');
http = require('http');
url = require('url');
var exec = require('child_process').exec

function execute(command, callback) {
  exec(command, function(error, stdout, stderr){ callback(stdout); });
};

var uuid = require('uuid');

http.createServer(function(req, res){
  var request = url.parse(req.url, true);
  var action = request.pathname;
  //console.log ("In var zit: " + request.query.var);
  //console.log("Action is gelijk aan: " + action);

  if (request.query.start){
    if (request.query.start.match(/^-\d{1,6}([shwdmy]|min)$/)){ //something like -4d or -523234s of -10min or -1m(onth)
      if (action == '/stroom.png'){
        displayImage("stroom", request.query.start);
      }
      if (action == '/gas.png'){
        displayImage("gas", request.query.start);
      }
    }
    else { displayUsage(); }
  }
  else { displayUsage(); }

  function displayUsage()
  {
    res.writeHead(200, {'Content-Type': 'text/plain' });
    res.end('Put something in the url like stroom.png?start=-2d or gas.png?start=-3w \n');    
  }

  function displayImage(power, start)
  {
    myUUID = uuid.v1();
    if (power == "stroom"){
      //command = "/home/sanderb/meter/graph.sh "+ start + " \"" + title + "\" /ramcache/" + myUUID + ".png";
      var command = "rrdtool graph /ramcache/" + myUUID + ".png -w 1200 -h 400 --start " + start + " \
 	      --title \"Stroom gebruik\" \
 	      --vertical-label \"Vermogen [W]\" \
 	      DEF:piek-in=/home/sanderb/meter/stroom.rrd:piek_in:AVERAGE \
 	      DEF:piek-out=/home/sanderb/meter/stroom.rrd:piek_out:AVERAGE \
 	      DEF:dal-in=/home/sanderb/meter/stroom.rrd:dal_in:AVERAGE \
 	      DEF:dal-out=/home/sanderb/meter/stroom.rrd:dal_out:AVERAGE \
 	      CDEF:piek-in-w=piek-in,3600,* \
 	      CDEF:piek-out-w=piek-out,-3600,* \
 	      CDEF:dal-in-w=dal-in,3600,* \
 	      CDEF:dal-out-w=dal-out,-3600,* \
 	      CDEF:piek-in-kwh=piek-in,1000,/ \
 	      CDEF:piek-out-kwh=piek-out,1000,/ \
 	      CDEF:dal-in-kwh=dal-in,1000,/ \
 	      CDEF:dal-out-kwh=dal-out,1000,/ \
              CDEF:dal-out-w2=dal-out,3600,* \
              CDEF:piek-out-w2=piek-out,3600,* \
 	      AREA:piek-in-w#F29D00:\"Piekstroom opgenomen\" \
 	      AREA:piek-out-w#2A5931:\"Piekstroom terug geleverd\" \
 	      AREA:dal-in-w#F26300:\"Dalstroom opgenomen\" \
 	      AREA:dal-out-w#00B554:\"Dalstroom terug geleverd\\n\" \
 	      VDEF:piek_in_total=piek-in-kwh,TOTAL \
 	      GPRINT:piek_in_total:\"Totaal piekstroom opgenomen\\:\t \t %6.2lf kWh\\t\" \
	      GPRINT:piek-in-w:LAST:\"Huidig verbruik piek\\:\t \t %6.1lf W\\n\" \
              VDEF:dal_in_total=dal-in-kwh,TOTAL \
 	      GPRINT:dal_in_total:\"Totaal dalstroom opgenomen\\:\t \t %6.2lf kWh\\t\" \
	      GPRINT:dal-in-w:LAST:\"Huidig verbruik dal\\:\t \t %6.1lf W\\n\" \
              VDEF:piek_out_total=piek-out-kwh,TOTAL \
 	      GPRINT:piek_out_total:\"Totaal piekstroom terug geleverd\\:\t %6.2lf kWh\\t\" \
	      GPRINT:piek-out-w2:LAST:\"Huidige terug levering piek\\:\t %6.1lf W\\n\" \
              VDEF:dal_out_total=dal-out-kwh,TOTAL \
	      GPRINT:dal_out_total:\"Totaal dalstroom terug geleverd\\:\t %6.2lf kWh\\t\" \
	      GPRINT:dal-out-w2:LAST:\"Huidige terug levering dal\\:\t %6.1lf W\\n\""; 
    }else if (power == "gas"){
      //command = "/home/sanderb/meter/graph_gas.sh " +start + " \"" + title + "\" /ramcache/" + myUUID + ".png"
      command = "rrdtool graph /ramcache/" + myUUID + ".png -w 1200 -h 400 --start " + start + " \
        --title \"Gas gebruik\" \
        --vertical-label \"Gas verbruik [dm3]\" \
        -X 1 \
        DEF:gas=/home/sanderb/meter/gas.rrd:gas:AVERAGE \
        CDEF:gas-kuub=gas,1000,/ \
        AREA:gas#F29D00:\"Gas in dm3\" \
        VDEF:gas-totaal=gas-kuub,TOTAL \
        GPRINT:gas-totaal:\"Totaal gas gebruikt in deze periode\\: %6.2lf m3\"";
    }
    //console.log(command);
    execute(command, function(error) {
      //console.log(error);
      var imagePath = "/ramcache/" + myUUID + ".png";
      //console.log (imagePath);
      fs.stat(imagePath, function (err, stat) {
        fs.readFile(imagePath, function (err, image){
          res.contentType = 'image/png';
          res.contentLength = stat.size;
          res.end(image, 'binary');
          fs.unlink(imagePath, function(err) {
            //console.log("Removing " + imagePath + err);
          });
        });
      });
    });
  }
}).listen(4040);
