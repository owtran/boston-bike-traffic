// Import Mapbox
import mapboxgl from 'https://cdn.jsdelivr.net/npm/mapbox-gl@2.15.0/+esm';

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


