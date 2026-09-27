// @ts-nocheck
export function useCalculatorMap({ inputMode }) {
    const state = { map: null, routeLayers: [], markers: [] }

    const initializeMap = () => {
        if (state.map || inputMode.value === 'km') return
        const mapElement = document.getElementById('map')
        if (!mapElement) return

        state.map = L.map(mapElement).setView([46.603354, 1.888334], 6)
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            keepBuffer: 2,
            updateWhenIdle: false,
            attribution: '© OpenStreetMap'
        }).addTo(state.map)
    }

    const clearMarkers = () => {
        if (!state.map) return
        state.markers.forEach(m => state.map.removeLayer(m))
        state.markers = []
    }

    const clearRoutes = () => {
        if (!state.map) return
        state.routeLayers.forEach(l => state.map.removeLayer(l))
        state.routeLayers = []
    }

    const clearMap = () => {
        clearMarkers()
        clearRoutes()
    }

    const fitMapToMarkers = () => {
        if (!state.map || state.markers.length === 0) return
        const group = L.featureGroup(state.markers)
        state.map.fitBounds(group.getBounds().pad(0.3), { maxZoom: 13, padding: [24, 24] })
    }

    const updateMarkers = (pointsList) => {
        if (!state.map) return
        clearMarkers()
        pointsList.forEach((pt) => {
            if (pt && pt.coords) {
                const bgColor = pt.color && pt.color.startsWith('#') ? pt.color : '#4f46e5'
                const icon = L.divIcon({
                    className: 'custom-marker',
                    html: `<div style="background-color: ${bgColor};" class="text-white font-bold w-6 h-6 rounded-full flex items-center justify-center text-[10px] shadow-md border-2 border-white">${pt.label}</div>`,
                    iconSize: [24, 24],
                    iconAnchor: [12, 12]
                })
                state.markers.push(L.marker([pt.coords.lat, pt.coords.lon], { icon }).addTo(state.map))
            }
        })
        fitMapToMarkers()
    }

    const destroyMap = () => {
        if (state.map) {
            state.map.remove()
            state.map = null
        }
        state.routeLayers = []
        state.markers = []
    }

    return { state, initializeMap, clearMarkers, clearRoutes, clearMap, fitMapToMarkers, updateMarkers, destroyMap }
}
