#!/usr/bin/nodejs

// ###################################### Globals, changes these ##########################
global.tty = "/dev/ttyAMA0";
global.SampleFreq = 6; //the frequency the RRD's are updated, so by my default one out of six is 1/minute
global.rrdStroom = "/home/my-home-dir/meter/stroom.rrd"; //create these RRD's first with the createRRD.sh script
global.rrdGas = "/home/my-home-dir/meter/gas.rrd";
global.rrdTool = "/usr/bin/rrdtool";
//#########################################################################################

var serialport = require("serialport");

/*
I'm on node v0.6.19 on a raspberry pi running Raspbian. To get the
serialPort package running on node < 0.7 you have to install an older version
like so:

npm install serialport@1.0.6

*/

var SerialPort = serialport.SerialPort; // localize object constructor
var exec = require('child_process').exec

function execute(command, callback) {
  exec(command, function(error, stdout, stderr){ callback(stdout); });
};

var mySerial = new SerialPort(global.tty, {
  baudrate: 9600,
  databits: 7,
  parity: 'even',
  parser: serialport.parsers.readline("\n")
});

function updateRRD(d, callback)
{
  var piek = parseInt(d.piekstroomTeller * 1000); //in rrd kunnen geen floats, alleen unsigned ints
  var dal = parseInt(d.dalstroomTeller * 1000);
  var piekTerug = parseInt(d.piekTerugTeller * 1000);
  var dalTerug = parseInt(d.dalTerugTeller * 1000);
  var gas = parseInt(d.gasStand * 1000);

  var updateStroomCommando = global.rrdTool + " update " + global.rrdStroom + " N:"+dal+":"+dalTerug+":"+piek+":"+piekTerug;
  var updateGasCommando = global.rrdTool + " update " + global.rrdGas + " N:"+gas;

  //console.log(updateStroomCommando);
  //console.log(updateGasCommando);

  execute(updateStroomCommando, function(errorRRDStroom){
    execute(updateGasCommando, function (errorRRDGas){
      callback(errorRRDStroom, errorRRDGas);
    });
  });
}

var messageCounter = global.SampleFreq-2; //telt aantal complete berichten dat langs komt.
//start deze op een waarde dat minimaal 1 (mogelijk incompleet) en 1 (zeker) compleet bericht aan komt.

//datastructuur om interessante counters in op te slaan
var d = {
  dalstroomTeller: 0,
  piekstroomTeller: 0,
  dalTerugTeller: 0,
  piekTerugTeller:0,
  gasStand: 0
};

mySerial.on("open", function () {
  console.log('Opened serial port');
  mySerial.on('data', function(data) {
    if (data.match(/^1-0:1.8.1/)){
      d.dalstroomTeller = parseFloat(data.match(/\d{5}\.\d*/));
      console.log("Dalstroomteller: " + d.dalstroomTeller + " kWh");
    }
    else if (data.match(/^1-0:1.8.2/)){
      d.piekstroomTeller = parseFloat(data.match(/\d{5}\.\d*/));
      console.log("Piekstroomteller: " + d.piekstroomTeller + " kWh");
    }
    else if (data.match(/^1-0:2.8.1/)){
      d.dalTerugTeller = parseFloat(data.match(/\d{5}\.\d*/));
      console.log("DalstroomTerugTeller: " + d.dalTerugTeller + " kWh");
    }
    else if (data.match(/^1-0:2.8.2/)){
      d.piekTerugTeller = parseFloat(data.match(/\d{5}\.\d*/));
      console.log("PiekstroomTerugTeller: " + d.piekTerugTeller + " kWh");
    }
    else if (data.match(/^\(\d{5}.\d*\)/)){
      d.gasStand = parseFloat(data.match(/\d{5}\.\d*/));
      console.log("GasStand: " + d.gasStand + " m3");
      messageCounter++;
      if (messageCounter == global.SampleFreq) //per global.SampleFreq berichten wordt de RRD bijgewerkt.
      {
        messageCounter = 0;
        console.log("Updating rrd...");
        updateRRD(d, function(errorStroom, errorGas) {
          console.log("Done updating RRD! " + errorStroom + errorGas);
        });
      }
    }
    else {
      //console.log(data);
    }
  });
});
