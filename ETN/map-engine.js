/* ETN map camera and imagery, using the same renderers as Kur aš?. */
(() => {
  'use strict';
  const {t,locale}=window.ETNI18n;
  const imagery='https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
  const imageryCredit='© <a href="https://www.arcgis.com/home/item.html?id=10df2279f9684e4a9f6a7f08febac2a9" target="_blank" rel="noopener">Esri, Vantor, Earthstar Geographics, GIS User Community</a>';
  const angle=value=>(value%360+360)%360;
  const shortest=(from,to)=>((to-from+540)%360)-180;
  const lngLat=point=>{const p=L.latLng(point);return[p.lng,p.lat];};
  const distance=(a,b)=>L.CRS.Earth.distance(L.latLng(a),L.latLng(b));
  function smoothHeading(map,setBearing){
    let target=null,frame=null,previous=0;
    function step(now){
      const dt=previous?Math.min(100,now-previous):16;previous=now;
      const delta=shortest(map.getBearing(),target);
      if(Math.abs(delta)>.05){
        setBearing(map.getBearing()+delta*(1-Math.exp(-dt/180)));
        frame=requestAnimationFrame(step);
      }else{setBearing(target);frame=null;previous=0;}
    }
    map.setHeading=value=>{
      if(!Number.isFinite(value))return map;
      target=angle(value);
      if(!frame)frame=requestAnimationFrame(step);
      return map;
    };
  }
  function raster(id){
    const leaflet=L.map(id,{zoomControl:false,zoomSnap:0,zoomDelta:.5,rotate:true,
      rotateControl:false,dragRotate:false,touchRotate:false}).setView([55.1694,23.8813],7);
    L.control.zoom({position:'bottomright'}).addTo(leaflet);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,
      attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}).addTo(leaflet);
    const photo=L.tileLayer(imagery,{maxZoom:19,maxNativeZoom:19,attribution:imageryCredit});
    const credit=leaflet.attributionControl?.getContainer?.();
    if(credit){
      // Keep the original attribution node: Leaflet continues to update its sources.
      const details=document.createElement('details'),summary=document.createElement('summary');
      details.className='leaflet-control etn-attribution';
      summary.textContent='i';summary.title=t('mapSources');summary.setAttribute('aria-label',t('mapSources'));
      credit.parentNode.replaceChild(details,credit);
      credit.classList.remove('leaflet-control');
      details.append(summary,credit);
      L.DomEvent.disableClickPropagation(details);L.DomEvent.disableScrollPropagation(details);
    }
    // Keep Leaflet's own bearing API intact: the rotation plugin also calls it.
    const map={engine:'raster',
      distance:(a,b)=>leaflet.distance(a,b),
      on(events,handler){leaflet.on(events,handler);return this;},
      getBearing:()=>angle(-leaflet.getBearing()),
      getContainer:()=>leaflet.getContainer(),getSize:()=>leaflet.getSize(),
      getBounds:()=>leaflet.getBounds(),latLngToContainerPoint:p=>leaflet.latLngToContainerPoint(p),
      invalidateSize(){leaflet.invalidateSize();return this;},
      panTo(point,options){leaflet.panTo(point,options);return this;},
      fitBounds(bounds,options){leaflet.fitBounds(bounds,options);return this;},
      setPhoto(enabled){
        if(enabled){photo.addTo(leaflet);photo.bringToFront();}
        else if(leaflet.hasLayer(photo))leaflet.removeLayer(photo);
      },
      addLocation:point=>L.circleMarker(point,{radius:8,color:'#fff',weight:3,
        fillColor:'#dd785f',fillOpacity:1}).addTo(leaflet)
    };
    smoothHeading(map,value=>leaflet.setBearing(-value));return map;
  }
  function create(id){
    let gl;
    try{
      if(!window.maplibregl)throw Error('Renderer unavailable');
      gl=new maplibregl.Map({container:id,style:'https://tiles.openfreemap.org/styles/liberty',
        center:[23.8813,55.1694],zoom:7,maxZoom:19,pitch:0,maxPitch:0,
        dragRotate:false,pitchWithRotate:false,touchPitch:false,attributionControl:false});
    }catch{
      document.getElementById(id).replaceChildren();return raster(id);
    }
    gl.touchZoomRotate.disableRotation();gl.keyboard.disableRotation();
    gl.addControl(new maplibregl.NavigationControl({showCompass:false}),'bottom-right');
    const attribution=new maplibregl.AttributionControl({compact:true});
    if(typeof attribution.onAdd==='function'){
      const onAdd=attribution.onAdd.bind(attribution);
      attribution.onAdd=value=>{
        const container=onAdd(value);
        // This vendor version opens compact controls initially; start minimized.
        container.classList.add('maplibregl-compact');
        container.classList.remove('maplibregl-compact-show');
        container.removeAttribute('open');
        const summary=container.querySelector('.maplibregl-ctrl-attrib-button');
        if(summary){summary.title=t('mapSources');summary.setAttribute('aria-label',t('mapSources'));}
        return container;
      };
    }
    gl.addControl(attribution,'bottom-left');
    const notice=document.getElementById('mapNotice');
    gl.on('error',()=>{notice.textContent=t('mapUnavailable');notice.hidden=false;});
    gl.on('idle',()=>{if(gl.areTilesLoaded())notice.hidden=true;});
    let photoEnabled=false,styleReady=false;
    const labelPaint=new Map();
    function applyPhoto(){
      if(!styleReady)return;
      gl.setLayoutProperty('etn-photo','visibility',photoEnabled?'visible':'none');
      for(const [id,paint] of labelPaint){
        gl.setPaintProperty(id,'text-color',photoEnabled?'#ffffff':paint.color);
        gl.setPaintProperty(id,'text-halo-color',photoEnabled?'#182028':paint.halo);
        gl.setPaintProperty(id,'text-halo-width',photoEnabled?1.5:paint.width);
      }
    }
    function hasName(expression){
      return Array.isArray(expression)&&((expression[0]==='get'&&/^name(?:[:_]|$)/.test(expression[1]))||expression.some(hasName));
    }
    gl.on('style.load',()=>{
      labelPaint.clear();
      for(const layer of gl.getStyle().layers||[]){
        if(layer.type!=='symbol')continue;
        if(layer.layout?.['text-field']){
          labelPaint.set(layer.id,{color:gl.getPaintProperty(layer.id,'text-color')??'#000000',
            halo:gl.getPaintProperty(layer.id,'text-halo-color')??'rgba(0,0,0,0)',
            width:gl.getPaintProperty(layer.id,'text-halo-width')??0});
          if(hasName(layer.layout['text-field']))gl.setLayoutProperty(layer.id,'text-field',
            ['coalesce',['get','name:'+locale],['get','name_'+locale],['get','name'],['get','name:latin'],'']);
          if(layer.layout['symbol-placement']==='line')gl.setLayoutProperty(layer.id,'symbol-placement','line-center');
          gl.setLayoutProperty(layer.id,'text-rotation-alignment','viewport');
          gl.setLayoutProperty(layer.id,'text-pitch-alignment','viewport');
          gl.setLayoutProperty(layer.id,'text-rotate',0);
          gl.setLayoutProperty(layer.id,'text-keep-upright',true);
        }
        if(layer.layout?.['icon-image']){
          gl.setLayoutProperty(layer.id,'icon-rotation-alignment','viewport');
          gl.setLayoutProperty(layer.id,'icon-pitch-alignment','viewport');
        }
      }
      gl.addSource('etn-photo',{type:'raster',tiles:[imagery],tileSize:256,
        minzoom:0,maxzoom:19,attribution:imageryCredit});
      gl.addLayer({id:'etn-photo',type:'raster',source:'etn-photo',layout:{visibility:'none'},
        paint:{'raster-fade-duration':200}},gl.getStyle().layers.find(layer=>layer.type==='symbol')?.id);
      styleReady=true;applyPhoto();
    });
    let headingTarget=null,camera=null,frame=null,previous=0;
    function startFrame(){if(!frame)frame=requestAnimationFrame(cameraFrame);}
    function cameraFrame(now){
      const dt=previous?Math.min(100,now-previous):16;previous=now;
      const view={};let pending=false;
      if(headingTarget!==null){
        const delta=shortest(gl.getBearing(),headingTarget);
        if(Math.abs(delta)>.05){view.bearing=gl.getBearing()+delta*(1-Math.exp(-dt/180));pending=true;}
        else if(Math.abs(delta)>0)view.bearing=headingTarget;
      }
      if(camera){
        const fraction=Math.min(1,(now-camera.at)/camera.duration),ease=fraction*fraction*(3-2*fraction);
        view.center=[camera.from.lng+shortest(camera.from.lng,camera.to[0])*ease,
          camera.from.lat+(camera.to[1]-camera.from.lat)*ease];
        view.zoom=camera.zoomFrom+(camera.zoomTo-camera.zoomFrom)*ease;
        if(fraction<1)pending=true;else camera=null;
      }
      if(Object.keys(view).length)gl.jumpTo(view);
      if(pending)frame=requestAnimationFrame(cameraFrame);else{frame=null;previous=0;}
    }
    function moveCamera(center,zoom,duration){
      camera={from:gl.getCenter(),to:center,zoomFrom:gl.getZoom(),zoomTo:zoom,
        at:performance.now(),duration:Math.max(1,duration)};startFrame();
    }
    gl.on('dragstart',()=>{camera=null;});
    gl.on('zoomstart',event=>{if(event.originalEvent)camera=null;});
    const map={
      engine:'vector',renderer:gl,distance,
      setPhoto(enabled){photoEnabled=!!enabled;applyPhoto();},
      on(events,handler){
        for(const event of events.split(' ')){
          if(event==='zoomanim'||event==='viewreset')continue;
          gl.on(event,handler);
        }return this;
      },
      getContainer:()=>gl.getContainer(),getBearing:()=>angle(gl.getBearing()),
      setHeading(value){if(Number.isFinite(value)){headingTarget=angle(value);startFrame();}return this;},
      getSize(){const c=gl.getContainer();return{x:c.clientWidth,y:c.clientHeight};},
      getBounds(){const b=gl.getBounds();return L.latLngBounds([b.getSouth(),b.getWest()],[b.getNorth(),b.getEast()]);},
      latLngToContainerPoint:point=>gl.project(lngLat(point)),
      invalidateSize(){gl.resize();return this;},
      panTo(point,options={}){
        const center=lngLat(point);
        if(options.animate===false){camera=null;gl.jumpTo({center});}
        else moveCamera(center,gl.getZoom(),(options.duration??.35)*1000);
        return this;
      },
      fitBounds(bounds,options={}){
        const b=L.latLngBounds(bounds),p=options.padding??[0,0];
        const view=gl.cameraForBounds([[b.getWest(),b.getSouth()],[b.getEast(),b.getNorth()]],{
          bearing:gl.getBearing(),padding:{left:p[0],right:p[0],top:p[1],bottom:p[1]},
          maxZoom:options.maxZoom??19});
        if(!view)return this;
        if(options.animate===false){camera=null;gl.jumpTo(view);}
        else{const center=maplibregl.LngLat.convert(view.center);moveCamera([center.lng,center.lat],view.zoom,350);}
        return this;
      },
      addLocation(point){
        const element=document.createElement('span');element.className='etn-location';
        const marker=new maplibregl.Marker({element}).setLngLat(lngLat(point)).addTo(gl);
        return{
          getLatLng(){const p=marker.getLngLat();return L.latLng(p.lat,p.lng);},
          setLatLng(point){marker.setLngLat(lngLat(point));return this;}
        };
      }
    };
    return map;
  }
  window.ETNMap={create};
})();

