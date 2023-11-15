const POPULATION_SERVICE_URL = 'https://services.arcgis.com/P3ePLMYs2RVChkJx/arcgis/rest/services/USA_Census_Counties/FeatureServer'
const ESRI_API_KEY = 'AAPK703bbf4bf7b84c8ca9ee01606fe0430cbBQwAqSYc7dXT33E-W7HMyo4iS5Xb0rV-Rwzv6csCU14P0KvFCdrqXQU3jsIu6St'
const FEATURE_SERVER_API = 'http://sampleserver5.arcgisonline.com/arcgis/rest/services/LocalGovernment/Events/FeatureServer'
const GEOMETRY_SERVER_API = 'http://tasks.arcgisonline.com/arcgis/rest/services/Geometry/GeometryServer'

let carGeometry = {
    type: "point",
    longitude: -122.3321,
    latitude: 47.6062
};

require([
    "esri/config",
    "esri/Map",
    "esri/views/MapView",
    "esri/widgets/Search",
    "esri/rest/geometryService",
    "esri/Graphic",
    "esri/rest/support/BufferParameters",
    "esri/layers/FeatureLayer",
    "esri/geometry/Point",
    "esri/rest/support/AreasAndLengthsParameters",
    "esri/rest/support/RouteParameters",
    "esri/rest/support/FeatureSet",
    "esri/rest/route",
], function(
    esriConfig,
    Map,
    MapView,
    Search,
    GeometryService,
    Graphic,
    BufferParameters,
    FeatureLayer,
    Point,
    AreasAndLengthsParameters,
    RouteParameters,
    FeatureSet,
    route
) {

    // set up esri
    esriConfig.apiKey = ESRI_API_KEY;
    const map = new Map({ basemap: "arcgis-navigation" });
    const view = new MapView({
        container: "viewDiv",
        map: map,
        center: [-122.690176,45.522054],
        zoom: 12
    });
    const search = new Search({  //Add Search widget
        view: view
    });
    view.ui.add(search, "top-right"); //Add to the map

    // add layers
    const populationFeatureLayer = new FeatureLayer({ url: POPULATION_SERVICE_URL });
    const pointsFeatureLayer = new FeatureLayer({ url: FEATURE_SERVER_API })

    map.add(populationFeatureLayer);
    map.add(pointsFeatureLayer);



    let points = []
    let path = false;
    let speed = 0;
    let bufferRadius = 0;
    let interesectedGraphics = []
    let currentBufferGraphic = undefined


    document.getElementById('speed').addEventListener('calciteSliderChange', (event) => {
        speed = event.target.value
        console.log(speed, "speed changed")
    })

    document.getElementById('buffer').addEventListener('calciteSliderChange', (event) => {
        bufferRadius = event.target.value
        console.log(bufferRadius, "bufferRadius changed")
    })

    search.on('search-complete', function(result){
        const point = new Point([result.results[0].results[0].feature.geometry.longitude, result.results[0].results[0].feature.geometry.latitude])
        const graphic = addGraphic("stop", point)
        points.push(graphic)
        graphic.attributes = {
            streetName: result.searchTerm
        }
        console.log(points, 'points')
        getRoute(points).then((paths) => {
            path = paths
        })
        refreshPointsToUi()
    });
    const carSymbol = {
        type: "picture-marker",
        url: "https://static.vecteezy.com/system/resources/previews/001/193/929/original/vintage-car-png.png",
        width: "100px",
        height: "48px"
    }

    const carAttributes = {
        name: "car",
        location: "Seattle"
    }

    const carGraphic = new Graphic({
        geometry: carGeometry,
        symbol: carSymbol,
        attributes: carAttributes
    });

    view.graphics.add(carGraphic);

    const getCarBuffer = async () => {
        const bufferParams = new BufferParameters({
            distances: [bufferRadius],
            unit: "kilometers",
            geodesic: true,
            bufferSpatialReference: view.spatialReference,
            outSpatialReference: view.spatialReference,
            geometries: [carGeometry]
        });
        const bufferedCar = await GeometryService.buffer(GEOMETRY_SERVER_API, bufferParams)

        return new Graphic({
            geometry: bufferedCar[0],
            symbol: {
                type: "simple-fill",
                color: [0, 0, 0, 0.2],
                outline: {
                    color: [0, 0, 0, 0.5],
                    width: 2
                }
            }
        });
    }


    getCarBuffer().then((buffer) => {
        currentBufferGraphic = buffer

        view.graphics.add(currentBufferGraphic);
    })

    view.graphics.removeAll()

    view.graphics.add(carGraphic);

    async function getRoute(points) {

        const routeUrl = "https://route-api.arcgis.com/arcgis/rest/services/World/Route/NAServer/Route_World/solve";

        const routeParams = new RouteParameters({
            stops: new FeatureSet({
                features: points
            }),
            returnDirections: true,
            directionsLanguage: "es"
        });

        let ruta = []

        const data = await route.solve(routeUrl, routeParams)
        if (data.routeResults.length > 0) {
            showRoute(data.routeResults[0].route);

            ruta = data.routeResults[0].route.geometry.paths
            return ruta
        }
    }

    function showRoute(routeResult) {
        routeResult.symbol = {
            type: "simple-line",
            color: [5, 150, 255],
            width: 3
        };
        console.log(routeResult)
        view.graphics.add(routeResult,0);
    }

    function addGraphic(type, point) {
        let color = "#ffffff";
        let outlineColor = "#000000"
        let size = "12px";
        if (type == "start") {
            color = "#ffffff";
        } else if (type == "stop") {
            color = "#000000";
            outlineColor = "#ffffff";
            size = "8px";
        } else {
            color = "#000000";
            outlineColor = "#ffffff";
        }
        const graphic = new Graphic({
            symbol: {
                type: "simple-marker",
                color: color,
                size: size,
                outline: {
                    color: outlineColor,
                    width: "1px"
                }
            },
            geometry: point
        });
        view.graphics.add(graphic);
        return graphic;
    }

    let interpolation = 0
    let currentPointIndex = 0
    // main loop
    let last = Date.now()



    const refreshBufferGraphic = (newGraphic) => {
        view.graphics.remove(currentBufferGraphic);
        currentBufferGraphic = newGraphic
        view.graphics.add(currentBufferGraphic);
    }

    const removeIntersectedGraphics = () => {
        for (const intersectedGraphic of interesectedGraphics) {
            view.graphics.remove(intersectedGraphic)
        }
        interesectedGraphics = []
    }

    const getIntersectedPopulation = async () => {
        let query = populationFeatureLayer.createQuery();
        query.geometry = currentBufferGraphic.geometry;
        query.spatialRelationship = "intersects";
        query.returnGeometry = true;
        query.outFields = [ "POPULATION" ];

        return await populationFeatureLayer.queryFeatures(query)
    }

    async function bufferLoop() {

        const buffer = await getCarBuffer()
        refreshBufferGraphic(buffer)

        const { features } = await getIntersectedPopulation()

        removeIntersectedGraphics()

        const promises = []

        // draw the intersected geometries
        for (const feature of features) {
            const intersectedGeometry = feature.geometry
            const intersectedGeometryGraphic = new Graphic({
                geometry: intersectedGeometry,
                symbol: {
                    type: "simple-fill",
                    color: [0, 0, 0, 0.2],
                    outline: {
                        color: [0, 0, 0, 0.5],
                        width: 2
                    }
                }
            });

            interesectedGraphics.push(intersectedGeometryGraphic)
            view.graphics.add(intersectedGeometryGraphic);
        }


        for (const feature of features) {
            promises.push(new Promise(async (resolve, reject) => {
                const population = feature.attributes.POPULATION;
                const countyGeometry = feature.geometry;

                const intersectedGeometriesPromise = GeometryService.intersect(
                    GEOMETRY_SERVER_API,
                    [countyGeometry],
                    currentBufferGraphic.geometry
                ).then((intersectedGeometries) => {
                    // only 1 geometry
                    const intersectedGeometry = intersectedGeometries[0]
                    // calculate area
                    return GeometryService.areasAndLengths(
                        GEOMETRY_SERVER_API,
                        new AreasAndLengthsParameters({
                            lengthUnit: 'kilometers',
                            areaUnit: 'square-kilometers',
                            calculationType: 'preserveShape',
                            polygons: [intersectedGeometry]
                        })
                    )
                })

                const countyAreaPromise = GeometryService.areasAndLengths(
                    GEOMETRY_SERVER_API,
                    new AreasAndLengthsParameters({
                        lengthUnit: 'kilometers',
                        areaUnit: 'square-kilometers',
                        calculationType: 'preserveShape',
                        polygons: [countyGeometry]
                    })
                )

                const [intersectedGeometryArea, countyArea] = await Promise.all([intersectedGeometriesPromise, countyAreaPromise])
                const interesectedRatio = intersectedGeometryArea.areas[0] / countyArea.areas[0]

                // return ratio * population
                resolve(interesectedRatio * population)
            }))
        }

        const results = await Promise.all(promises)
        const totalPopulation = results.reduce((a, b) => a + b, 0)
        document.getElementById('total-pop').innerHTML = totalPopulation

        // draw the intersected geometries
        //for (const countyGraphic of interesectedGraphics) {
        //    view.graphics.add(countyGraphic);
        //}
        //     const intersectedGeometry = feature.geometry


        // this should not work lol


    }

    function animateCar() {

        if (path) {

            const now = Date.now()

            const delta = now - last

            const currentPoint = path[0][currentPointIndex]
            const nextPoint = path[0][currentPointIndex + 1]

            const distance = Math.sqrt(
                Math.pow(currentPoint[0] - nextPoint[0], 2) +
                Math.pow(currentPoint[1] - nextPoint[1], 2)
            )

            last = now
            interpolation += (speed * (1/10000000) * (delta)) / distance

            if (interpolation > 1) {
                interpolation = 0
                currentPointIndex += 1
                if (currentPointIndex >= path[0].length - 1) {
                    currentPointIndex = 0
                }
            }

            const currentPointGeometry = {
                type: "point",
                longitude: currentPoint[0],
                latitude: currentPoint[1]
            }
            const nextPointGeometry = {
                type: "point",
                longitude: nextPoint[0],
                latitude: nextPoint[1]
            }

            carGeometry = {
                type: "point",
                longitude: currentPointGeometry.longitude + (nextPointGeometry.longitude - currentPointGeometry.longitude) * interpolation,
                latitude: currentPointGeometry.latitude + (nextPointGeometry.latitude - currentPointGeometry.latitude) * interpolation
            }
            carGraphic.geometry = new Point(
                carGeometry
            )

        }
    }

    // car loop
    setInterval(async function() {
        window.requestAnimationFrame(animateCar);
    },0)

    // buffer loop
    setInterval(async function() {
        await bufferLoop()
    }, 1000)

    for (const point of points) {
        point.attributes = {
            eventId: 23423
        }
    }

    pointsFeatureLayer.applyEdits({
        addFeatures: points
    }).then(function(results) {
        console.log("edits added: ", results);
    });

    function refreshPointsToUi() {
        const list = document.getElementById('list')
        list.innerHTML = ''
        for (const point of points) {
            const listItem = document.createElement('calcite-list-item')
            listItem.label = point.attributes.streetName
            listItem.description = point.attributes.eventId
            list.appendChild(listItem)
        }
    }

});



