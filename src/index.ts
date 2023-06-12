/**
 * This is a minimal example of sigma. You can use it as a base to write new
 * examples, or reproducible test cases for new issues, for instance.
 */
import Graph from "graphology";
import Sigma from "sigma";
import L from "leaflet";
import { pick } from "lodash";
import dataset from "./airport.json";

//TODO : Max bounds on graph

// State to keep the hovered node
let hoveredNode: string | null = null;

// Map creation
// NOTE:
//  - `zoomSnap` is mandatory, it's to allow fraction for zoom level.
//  - you can configure the CRS if you want
const map = L.map("map", {
  zoomControl: false,
  zoomDelta: 0.25,
  zoomSnap: 0,
  zoom: 0
}).setView([0, 0], 0);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

// Sigma creation
// Note:
//  - `stagePadding: 0` is mandatory, so the bbox of the map & Sigma is the same.
//  - node & edge reducer are defined mainly to support node hovered feature
const graph = new Graph();
const container = document.getElementById("sigma") as HTMLElement;
const renderer = new Sigma(graph, container, {
  stagePadding: 0,
  nodeReducer: (node, data) => {
    const newData: any = {
      ...data,
      highlighted: data.highlighted || false,
      hidden: false
    };
    // if there is an hovered node, we only display its neighbour
    if (hoveredNode !== null) {
      if (node === hoveredNode || graph.neighbors(hoveredNode).includes(node)) {
        newData.highlighted = true;
      } else {
        newData.hidden = true;
        newData.highlighted = false;
      }
    }
    return newData;
  },
  edgeReducer: (edge, data) => {
    const newData: any = { ...data, size: data.weight, hidden: false };
    // if there is an hovered node, we only display its neighbour
    if (
      hoveredNode !== null &&
      !graph.extremities(edge).includes(hoveredNode)
    ) {
      newData.hidden = true;
    }
    return newData;
  }
});

//
// Useful functions
//

/**
 * Given a geo point, (ie. [lat, lng]), returns its graph coords (ie. {x, y}).
 */
function latlngToGraph(coord: [number, number]): { x: number; y: number } {
  const geoProjection = pick(map.project(coord, 0), ["x", "y"]);
  const graphDimensions = renderer.getDimensions();
  debugger;
  return {
    x: geoProjection.x,
    // Y are reversed between geo / sigma
    y: graphDimensions.height - geoProjection.y
  };
}

/**
 * Given a graph coords (ie. {x,y}), return it's lat/lng (ie. [lat, lng]).
 */
function graphToLatlng(coords: { x: number; y: number }): [number, number] {
  const graphDimensions = renderer.getDimensions();
  // Y are reversed between geo / sigma
  const geoUnprojected = map.unproject(
    [coords.x, graphDimensions.height - coords.y],
    0
  );
  return [geoUnprojected.lat, geoUnprojected.lng];
}

/**
 * Synchronise the sigma BBOX with the leaflet one.
 *
 * @param animated If true, performs a fitBounds instead of a flyToBounds
 */
function syncLeafletBboxWithGraphBbox(animated = true): void {
  // Graph BBOX
  const graphDimensions = renderer.getDimensions();
  const graphTopLeft = renderer.viewportToGraph({ x: 0, y: 0 });
  const graphBottomRight = renderer.viewportToGraph({
    x: graphDimensions.width,
    y: graphDimensions.height
  });
  const geoTopLeft = graphToLatlng(graphTopLeft);
  const geoBottomRight = graphToLatlng(graphBottomRight);
  // Set map BBOX
  map.flyToBounds([geoTopLeft, geoBottomRight], {
    animated: true,
    duration: 0.01
  });
}

// Build the dataset as a graph
// We load the dataset from the JSON, and for each node, we compute its (x,y) coords
// by using the CRS projection of the map (see `latlngToGraph` function)
const gd = new Graph();
gd.import(dataset as any);
gd.nodes().forEach((node) => {
  gd.updateNodeAttributes(node, (data) => {
    const graphProjection = latlngToGraph([data.latitude, data.longitude]);
    return {
      label: data.fullName,
      size: Math.log(gd.degree(node)),
      color: "#F98E24",
      ...graphProjection
    };
  });
});
// load the computed graph into the sigma one
graph.import(gd);
// refresh Sigma
renderer.refresh();

// Register event to manage state hoveredNode
renderer.on("enterNode", (event) => {
  hoveredNode = event.node;
  renderer.refresh();
});
renderer.on("leaveNode", () => {
  hoveredNode = null;
  renderer.refresh();
});

// Sync sigma camera with graph
renderer.getCamera().on("updated", () => syncLeafletBboxWithGraphBbox());

// Init the bbx between sigma & leaflet
syncLeafletBboxWithGraphBbox(false);
