
import mapboxgl from 'https://cdn.jsdelivr.net/npm/mapbox-gl@2.15.0/+esm';
import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

// Check that Mapbox loaded
console.log('Mapbox GL JS Loaded:', mapboxgl);

// Set your Mapbox access token
mapboxgl.accessToken = 'pk.eyJ1Ijoib3d0cmFuIiwiYSI6ImNtdzV4OWs0czBhZ2wzMHByMmtydHFsangifQ.a12kIPajWluIlEee0eFc3w';

// Initialize the map
const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/streets-v12',
    center: [-71.09415, 42.36027],
    zoom: 12,
    minZoom: 5,
    maxZoom: 18,
});

const svg = d3.select('#map').select('svg');

function getCoords(station) {
    const point = new mapboxgl.LngLat(
        +station.lon,
        +station.lat // + converts values into numbers!
    );

    const { x, y } = map.project(point);

    return { cx: x, cy: y };
}

// map.project() converts longitude and latitude into pixel coordinates.

// STEP 5.2: Convert minutes into AM/PM time
function formatTime(minutes) {
    const date = new Date(0, 0, 0, 0, minutes);

    return date.toLocaleString('en-US', {
        timeStyle: 'short'
    });
}

// STEP 5.3: Convert a Date into minutes since midnight
function minutesSinceMidnight(date) {
    return date.getHours() * 60 + date.getMinutes();
}

// STEP 5.3: Filter trips by selected time
function filterTripsbyTime(trips, timeFilter) {

    return timeFilter === -1
        ? trips
        : trips.filter((trip) => {

            const startedMinutes =
                minutesSinceMidnight(trip.started_at);

            const endedMinutes =
                minutesSinceMidnight(trip.ended_at);

            return (
                Math.abs(startedMinutes - timeFilter) <= 60 ||
                Math.abs(endedMinutes - timeFilter) <= 60
            );
        });
}

// STEP 5.3: Calculate traffic for each station
function computeStationTraffic(stations, trips) {

    // Count departures
    const departures = d3.rollup(
        trips,
        (v) => v.length,
        (d) => d.start_station_id
    );

    // Count arrivals
    const arrivals = d3.rollup(
        trips,
        (v) => v.length,
        (d) => d.end_station_id
    );

    // Add traffic counts to stations
    return stations.map((station) => {

        let id = station.short_name;

        station.arrivals = arrivals.get(id) ?? 0;

        station.departures = departures.get(id) ?? 0;

        station.totalTraffic =
            station.arrivals + station.departures;

        return station;
    });
}


map.on('load', async () => {

    // STEP 2.1: Boston bike lanes
    map.addSource('boston_route', {
        type: 'geojson',
        data: 'https://bostonopendata-boston.opendata.arcgis.com/datasets/boston::existing-bike-network-2022.geojson',
    });

    map.addLayer({
        id: 'bike-lanes',
        type: 'line',
        source: 'boston_route',
        paint: {
            'line-color': '#32D400',
            'line-width': 5,
            'line-opacity': 0.6,
        },
    });

    // STEP 2.3: Cambridge bike lanes
    map.addSource('cambridge_route', {
        type: 'geojson',
        data: 'https://data.cambridgema.gov/resource/9aey-9g9p.geojson?$limit=50000',
    });

    map.addLayer({
        id: 'cambridge-bike-lanes',
        type: 'line',
        source: 'cambridge_route',
        paint: {
            'line-color': '#32D400',
            'line-width': 5,
            'line-opacity': 0.6,
        },
    });

    // STEP 3.1: Load Bluebikes station data
    try {
        const jsonurl = 'https://dsc106.com/labs/lab07/data/bluebikes-stations.json';

        const jsonData = await d3.json(jsonurl);

        console.log('Loaded JSON Data:', jsonData);

        let stations = jsonData.data.stations;

        console.log('Stations Array:', stations);

        // STEP 4.1: Load bike trip data
        const trafficUrl =
            'https://dsc106.com/labs/lab07/data/bluebikes-traffic-2024-03.csv';

        const trips = await d3.csv(trafficUrl, (trip) => {
        trip.started_at = new Date(trip.started_at);
        trip.ended_at = new Date(trip.ended_at);

        return trip;
        });

        // Log AFTER the CSV finishes loading
        console.log('First trip start:', trips[0].started_at);

 // d3.csv downloads dataset, await waits for data to finsih loading, trips stores the resulting array of bike trips!! 

        console.log('Bike Trips:', trips);
        console.log('Total Trips:', trips.length);

        // STEP 5.3: Calculate station traffic
        stations = computeStationTraffic(stations, trips);
       
        console.log('Stations with Traffic:', stations);


        // STEP 4.3: Scale circle sizes based on traffic
        const radiusScale = d3
            .scaleSqrt()
            .domain([0, d3.max(stations, (d) => d.totalTraffic)])
            .range([0, 25]);

        // STEP 6.1: Categorize station traffic flow
        let stationFlow = d3
            .scaleQuantize()
            .domain([0, 1])
            .range([0, 0.5, 1]);


        const circles = svg
            .selectAll('circle')
            .data(stations, (d) => d.short_name)
            .enter()
            .append('circle')
            .attr('r', (d) => radiusScale(d.totalTraffic))
            .attr('stroke', 'white')
            .attr('stroke-width', 1)
            .attr('opacity', 0.8)
            .each(function (d) {
                d3.select(this)
                    .append('title')
                    .text(
                        `${d.totalTraffic} trips (${d.departures} departures, ${d.arrivals} arrivals)`
                    );
            })
            .style('--departure-ratio', (d) =>
                stationFlow(d.totalTraffic > 0 ? d.departures / d.totalTraffic : 0.5)
            );

        function updatePositions() {
            circles
                .attr('cx', (d) => getCoords(d).cx)
                .attr('cy', (d) => getCoords(d).cy); // getCoords -> converts each location to pixels!
            }

        // Position circles initially
        updatePositions();

        map.on('move', updatePositions);
        map.on('zoom', updatePositions);
        map.on('resize', updatePositions);
        map.on('moveend', updatePositions);

        // STEP 5.2: Select slider elements
        const timeSlider = document.getElementById('time-slider');
        const selectedTime = document.getElementById('selected-time');
        const anyTimeLabel = document.getElementById('any-time');

        let timeFilter = -1;


        // STEP 5.2: Make the time update
        function updateTimeDisplay() {
            timeFilter = Number(timeSlider.value);

            if (timeFilter === -1) {
                selectedTime.textContent = '';
                anyTimeLabel.style.display = 'block';
            } else {
                selectedTime.textContent = formatTime(timeFilter);
                anyTimeLabel.style.display = 'none';
            }

            // Update circles whenever the slider changes
            updateScatterPlot(timeFilter);
        }
        

        // STEP 5.3: Update circles based on selected time
        function updateScatterPlot(timeFilter) {

            // Filter trips based on selected time
            const filteredTrips = filterTripsbyTime(trips, timeFilter);

            // Recalculate station traffic
            const filteredStations = computeStationTraffic(stations, filteredTrips);

            timeFilter === -1
            ? radiusScale.range([0, 25])
            : radiusScale.range([3, 50]);

            // Update circle sizes and departure ratios
            circles
                .data(filteredStations, (d) => d.short_name)
                .attr('r', (d) => radiusScale(d.totalTraffic))
                .style('--departure-ratio', (d) =>
                    stationFlow(
                        d.totalTraffic > 0
                            ? d.departures / d.totalTraffic
                            : 0.5
                    )
                );

        }
        

        // Update whenever the slider moves
        timeSlider.addEventListener('input', updateTimeDisplay);

        // Display the initial slider value
        updateTimeDisplay();

        
    } catch (error) {
        console.error('Error loading JSON:', error);
    }
});



// Code	                    Simple explanation
// map.on('load')	        Wait until the map finishes loading
// map.addSource()	        Connect the Boston bike lane dataset
// map.addLayer()	        Draw those bike lanes on the map
// type: 'line'	            Draw lines instead of dots
// line-color	            Make the lines green
// line-width: 3	        Set line thickness to 3 pixels
// line-opacity: 0.4	    Make the lines 40% visible



// Code	                            Meaning
// addSource()	                    Load Cambridge's GeoJSON data
// cambridge_route	                Unique name for the Cambridge dataset
// addLayer()	                    Draw the Cambridge bike lanes
// source: 'cambridge_route'	    Use the Cambridge dataset we loaded
// type: 'line'	                    Draw the bike lanes as lines
// paint	                        Make them bright green, just like Boston



// Code	                    Simple explanation
// try	                        Attempt to run the code
// const jsonurl	            Store the dataset URL
// await d3.json(jsonurl)	    Download and parse the JSON data
// jsonData	                Variable holding the downloaded data
// jsonData.data.stations	    Extract the list of bike stations
// console.log()	            Print the data to the browser console
// catch (error)	            Handle errors if loading fails



// Code	                        Meaning
// selectAll('circle')	        Select existing circles
// .data(stations)	            Connect the 453 stations to circles
// .enter()	                    Identify circles that need to be created
// .append('circle')	        Create the circles
// .attr('r', 5)	            Give each circle a 5-pixel radius
// .attr('fill', 'steelblue')	Make the circles blue




// The lab provides a dataset containing approximately 260,000 bike rides from March 2024.

// Each row represents one bike trip.
// Column	            Meaning
// ride_id	            Unique identifier for the trip
// bike_type	        Electric or regular bike
// started_at	        When the ride started
// ended_at	        When the ride ended
// start_station_id	Station where the ride began
// end_station_id	    Station where the ride ended
// is_member	        Whether the rider is a member

// We want to calculate three things for every bike station:
// 1. Departures — How many rides started at this station?
// 2. Arrivals — How many rides ended at this station?
// 3. Total traffic — Departures + arrivals.

// For example:
// Station	        Departures	Arrivals	Total Traffic
// Station A	    100	        80	        180
// Station B	    50	        120	        170
// Station C	    200	        150	        350