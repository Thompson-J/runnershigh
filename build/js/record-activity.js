var geolocation = [];
let geodata = [];

// Launch fullscreen for browsers that support it!
// Find the right method, call on correct element
function launchIntoFullscreen(element) {
  if(element.requestFullscreen) {
    element.requestFullscreen();
  } else if(element.mozRequestFullScreen) {
    element.mozRequestFullScreen();
  } else if(element.webkitRequestFullscreen) {
    element.webkitRequestFullscreen();
  } else if(element.msRequestFullscreen) {
    element.msRequestFullscreen();
  }
}
// Whack fullscreen
function exitFullscreen() {
  if(document.exitFullscreen) {
    document.exitFullscreen();
  } else if(document.mozCancelFullScreen) {
    document.mozCancelFullScreen();
  } else if(document.webkitExitFullscreen) {
    document.webkitExitFullscreen();
  }
}

// When the page has loaded
$(function() {

	// If this is the record activity page
	if (document.location.pathname == "/record-activity/") {

		// Setup TomTom Maps For Web
		tomtom.setProductInfo('Runners High', '1');
		// Create a map for plotting points on
		var map = new tomtom.L.map('record_map', {
			key: 'KnsAaGwLdpHmAeEIqvGYOfQXTZxXczGx'
		}).locate({setView: true, maxZoom: 16});

		var d, date, start_time, finish_time, distance, duration;

		// Stopwatch credit: https://jsfiddle.net/Daniel_Hug/pvk6p/
		var time_display = document.getElementById('time_display'),
		  clear = document.getElementById('record_clear'),
		  seconds = 0, minutes = 0, hours = 0,
		  t;

		// Add a second to the counter
		function add() {
			// Iterate the second by 1
		  seconds++;
		  // Iterate the minutes by 1
		  if (seconds >= 60) {
		    seconds = 0;
		    minutes++;
		    // Iterate the hours by 1
		    if (minutes >= 60) {
		      minutes = 0;
		      hours++;
		    }
		  }
		  
		  // Update the time display
		  time_display.textContent = (hours ? (hours > 9 ? hours : "0" + hours) : "00") + ":" + (minutes ? (minutes > 9 ? minutes : "0" + minutes) : "00") + ":" + (seconds > 9 ? seconds : "0" + seconds);

		  // Ask for the time
		  timer();
		}
		// Calling timer() starts the clock
		function timer() {
			// Run the timer every second
		  t = setTimeout(add, 1000);
		}

		/* Clear button */
		$('#record_clear').click(function() {

		  // Reset the timer display
		  time_display.textContent = "00:00:00";
		  // Reset the timer to 00:00:00
		  seconds = 0; minutes = 0; hours = 0;
		
		});

		// Not currently recording a run
		var recording = false;
		var locationTimer;
		var wakelock = new NoSleep();

		// When the record button is clicked
		$('#record_btn').click(function() {

			// Toggle an active class
			$(this).toggleClass('active');

			if (!recording) {

				// Start recording
				recording = true;

				// Add the recording class
				document.body.classList.add('recording');

				// Enable the wake lock
				wakelock.enable();

				// Enter fullscreen
				//launchIntoFullscreen(document.documentElement); // the whole page
				launchIntoFullscreen(document.getElementById('timer')); // specific element

				// Vibrate
				window.navigator.vibrate(200);
				
				// Record today's date and start time
				d = new moment();
				date = d.format('YYYY/MM/DD');
				start_time = new moment();

				// Ask for the browser for the location every 5 seconds
				locationTimer = window.setInterval(getLocation, 5000);

				// Start the timer
				timer();
			
			} else {
			
				// Store the finish time and duration
				finish_time = new moment();
				duration = finish_time.diff(start_time);
				duration = moment.utc(duration).format('HH:mm:ss');
				//console.log(duration)

				// Disable the wake lock
				wakelock.disable();
				// Exit fullscreen
				exitFullscreen();

				// Vibrate
				window.navigator.vibrate(200);

				// Remove the recording class
				document.body.classList.remove('recording');

				// Stop the timer
				clearTimeout(t);
				recording = false;
				clearInterval(locationTimer);

				// This is the end of the run so calculate the distance
				getDistance();

				setTimeout(function() {
					
					$('#distance').text(distance);
				
				}, 1000);
			
			}
		});

		// When the submit button is clicked
		$('#record_submit').click(function() {

			// If recording, stop recording and attempt to submit
			if (recording) $('#record_btn').click();

			// We've finished the run so ask TomTom to plot a route and calculate the distance
			getDistance();

			submit_activity.activity = document.getElementById('record_title').value;
			submit_activity.date = date;
			submit_activity.distance = distance;
			submit_activity.start_time = start_time.format('HH:mm:ss');
			submit_activity.finish_time = finish_time.format('HH:mm:ss');
			submit_activity.duration = duration;
			let i;
			for(i = 0; i < geolocation.length; i++) {
				geodata[i] = {'accuracy': geolocation[i].accuracy, 'altitude': geolocation[i].altitude, 'altitudeAccuracy': geolocation[i].altitudeAccuracy, 'heading': geolocation[i].heading, 'latitude': geolocation[i].latitude, 'longitude': geolocation[i].longitude, 'speed': geolocation[i].speed, 'timestamp': geolocation[i].timestamp}
			}
			// Convert the geolocation array into a string
			submit_activity.waypoints = JSON.stringify(geodata);

			console.log(submit_activity)
			submit_activity.submit();
		
		})

		// Ask the browser for the current location
		function getLocation() {
			
			// Check if the browser has geolocation enabled
	    if (navigator.geolocation) {
	    	// Ask the browser for geolocation data and pass it to trackLocations()
	    	// If an error occurs pass the error to showError()
      	navigator.geolocation.getCurrentPosition(trackLocations, showError);
	    } else {
	    	alert("The browser has geolocation disabled");
        //console.log("Geolocation is not supported by this browser.");
	    }

		}

		// There are 4 difference types of error responses from the browser geolocation
		function showError(error) {
		  switch(error.code) {
		  	// If the user denied permission for geolocation
			  case error.PERMISSION_DENIED:
		      console.log("User denied the request for Geolocation.");
		      break;
		    // The browser is not reporting the position
			  case error.POSITION_UNAVAILABLE:
		      console.log("Location information is unavailable.");
		      break;
	      // The GPS request timed out
			  case error.TIMEOUT:
		      console.log("The request to get user location timed out.");
		      break;
				case error.UNKNOWN_ERROR:
					console.log("An unknown error occurred.");
					break;
		  }
		}

		var coords;
		var waypointCount = 0;
		var startPoint;
		var finishPoint;

		// Callback function to run when the browser has the current location
		// Store the realtime geolocation information and plot it on the map
		function trackLocations(coordinates) {

			// Store the position
			//console.log(coordinates);
			geolocation.push(coordinates.coords);
			// Add the timestamp
			let time = new Date(coordinates.timestamp);
			geolocation[geolocation.length-1].timestamp = time.toUTCString();
			
			// Iterate the waypoint count by 1
			waypointCount ++;

			// Settings for how the marker should look
			var markerOptions = {
		    icon: tomtom.L.icon({
		      iconUrl: '/tomtom/images/marker-black.png',
		      iconSize: [30, 34],
		      iconAnchor: [15, 34]
		    })
			};

			// Plot the point on the map
			tomtom.L.marker([geolocation[geolocation.length - 1].latitude, geolocation[geolocation.length - 1].longitude], markerOptions)
			.bindPopup("Waypoint: " + waypointCount).addTo(map);

			// Get the distance
			var points = '';

			// Add the first waypoint to the string	
			points += geolocation[0].latitude + ',' + geolocation[0].longitude + ":";
			
			// Add the last waypoint to the string
			points += geolocation[geolocation.length-1].latitude + ',' + geolocation[geolocation.length-1].longitude;

			let supportingPoints = geolocation.slice(1,-1);

			var i;
			for(i = 0; i < supportingPoints.length; i++) {
				supportingPoints[i] = supportingPoints[i].latitude + "," + supportingPoints[i].longitude;
			}

			if (supportingPoints.length == 0) {

				tomtom.routing().locations(points).go()
				  .then(function(routeGeoJson) {
				  	// routeGeoJson is TomTom's route
				  	console.log(routeGeoJson)
				  	// Store the distance of the route
				    distance = routeGeoJson.features[0].properties.summary.lengthInMeters;
				  });

			} else {

				tomtom.routing().locations(points).supportingPoints(supportingPoints).go()
				  .then(function(routeGeoJson) {
				  	// routeGeoJson is TomTom's route
				  	console.log(routeGeoJson)
				  	// Store the distance of the route
				    distance = routeGeoJson.features[0].properties.summary.lengthInMeters;
				  });

			}

			// Reinventing the wheel so use TomTom instead.
			// Calculate the distance between two points using Pythagrean Theorem
			// Loop through the coordinates
			/*geolocation.forEach(function(element, index) {

				// Skip the last index of the array
				if (index < geolocation.length-1) {

					// The x set of coordinates from the current array element
					let xLon = element.longitude;
					let xLat = element.latitude;
					// The y set of coordinates, found in the next array element
					let yLon = geolocation[index+1].longitude;
					let yLat = geolocation[index+1].latitude;

					// A derivation of the Pythagrean Theorem to calculate distance
					// https://www.purplemath.com/modules/distform.htm
					let pythagrean = Math.sqrt(Math.pow(xLon-xLon, 2) + Math.pow(xLat-yLat, 2));
					//console.log(pythagrean);

					// Store the hypotenuse as a string
					let string = pythagrean.toString();

					// Using a regular expression search for .0[…]0 in the hypotenuse
					//Store the position of the first significant number
					let regex = /\.0+/;
					// Run the search
					let regexResult = string.match(regex);
					//console.log(signiNo);
					// Find the starting position of the first significant number
					let signStPos = regexResult['index'] + regexResult[0].length;
					// Log the first 3 significant numbers
					let threeSign = string.substr(signStPos, 3);
					console.log(threeSign)

				}

			})*/

			if (distance > 1000) distance = distance / 1000 + " kilometers";
			else distance = distance + " meters";
			$('#distance').text(distance);

		}

		// Requires network access
		function getDistance() {

			// Create a blank string
			var points = '';

			// Add the first waypoint to the string	
			points += geolocation[0].latitude + ',' + geolocation[0].longitude + ":";
			
			// Add the last waypoint to the string
			points += geolocation[geolocation.length-1].latitude + ',' + geolocation[geolocation.length-1].longitude;

			let supportingPoints = geolocation.slice(1,-1);
			
			var i;
			for(i = 0; i < supportingPoints.length; i++) {
				supportingPoints[i] = supportingPoints[i].latitude + "," + supportingPoints[i].longitude;
			}

			if (supportingPoints.length == 0) {

				// Send the geolocation to TomTom and ask for a calculated route
				// eg. points = '53.431320,-2.433381:53.433481,-2.429637';
				tomtom.routing().locations(points).go()
			  .then(function(routeGeoJson) {
			  	// routeGeoJson is TomTom's route
			  	var route = tomtom.L.geoJson(routeGeoJson, {
			    	style: {color: '#00d7ff', opacity: 0.6, weight: 6}
			    })
			    // Highlight the route on the map
			    .addTo(map);
					map.fitBounds(route.getBounds(), {padding: [5, 5]});
			  	console.log(routeGeoJson)
			  	// Store the distance of the route
			    distance = routeGeoJson.features[0].properties.summary.lengthInMeters;
			  });

			} else {

				// Send the geolocation to TomTom and ask for a calculated route
				// eg. points = '53.431320,-2.433381:53.433481,-2.429637';
				tomtom.routing().locations(points).supportingPoints(supportingPoints).go()
			  .then(function(routeGeoJson) {
			  	// routeGeoJson is TomTom's route
			  	var route = tomtom.L.geoJson(routeGeoJson, {
			    	style: {color: '#00d7ff', opacity: 0.6, weight: 6}
			    })
			    // Highlight the route on the map
			    .addTo(map);
					map.fitBounds(route.getBounds(), {padding: [5, 5]});
			  	console.log(routeGeoJson)
			  	
			  	// Store the distance of the route
			    distance = routeGeoJson.features[0].properties.summary.lengthInMeters;
			    if (distance > 1000) distance = distance / 1000 + " kilometers";
					else distance = distance + " meters";

			  });

			}


		}

	}

});