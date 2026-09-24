'use strict';
let liveConfig={ready:false},liveImages=[],lastPhotoFile=null,generationAbort=null,generationJob=null;
const apiHeaders={'X-Vatika-Request':'1'};
async function api(url,options={}){const r=await fetch(url,{credentials:'same-origin',cache:'no-store',...options,headers:{...apiHeaders,...options.headers}});const data=await r.json();if(!r.ok)throw Error(data.error||'The request could not be completed.');return data}
function updateServiceNotice(){const notice=document.querySelector('.privacy');if(!notice)return;notice.textContent=liveConfig.ready?'Live generation · Choosing a photo sends it to OpenAI for one paid hairstyle preview. Temporary server images expire within 30 minutes.':liveConfig.unavailable?'Image service unavailable. Please reload before uploading.':'Demo mode · Prepared reference images only. Your photo stays in this browser.';}
async function refreshServiceConfig(){if(location.protocol==='file:'){liveConfig={ready:false};updateServiceNotice();return}try{liveConfig=await api('/api/config')}catch{liveConfig={ready:false,unavailable:true}}updateServiceNotice();}
const configReady=refreshServiceConfig();
async function normalisePhoto(file){const url=URL.createObjectURL(file);try{const img=new Image();img.src=url;await img.decode();const scale=Math.min(1,1024/Math.max(img.naturalWidth,img.naturalHeight));const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);return await new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(Error('Could not prepare the photo.')),'image/png'))}finally{URL.revokeObjectURL(url)}}
function resetGeneration(){generationAbort?.abort();generationAbort=null;if(generationJob){fetch('/api/jobs/'+generationJob,{method:'DELETE',headers:apiHeaders,credentials:'same-origin',keepalive:true}).catch(()=>{});generationJob=null}liveImages.forEach(url=>URL.revokeObjectURL(url));liveImages=[];lastPhotoFile=null;const p=document.getElementById('generation-progress');if(p){p.hidden=true;document.getElementById('generation-section').append(p);}document.querySelector('[data-export="collage"]').disabled=false;const c=document.getElementById('reveal');if(c)c.disabled=false}
function generationState(title,detail,error=false){
 document.getElementById('generation-title').textContent=title;
 document.getElementById('generation-subtitle').textContent=detail;
 document.getElementById('generation-section').classList.toggle('generation-error',error);
 document.getElementById('generation-back').hidden=!error;
 document.getElementById('generation-meter').hidden=error;
 document.getElementById('generation-section').querySelector('.hint').hidden=error;
}
function showGenerationScreen(){
 showStep(1);document.getElementById('intro-section').hidden=true;
 const section=document.getElementById('generation-section');section.hidden=false;currentStep=1.5;
 section.append(document.getElementById('generation-progress'));
 document.getElementById('generation-progress').hidden=false;
 document.getElementById('generation-meter').value=0;
 document.getElementById('generation-message').textContent='Getting your photo ready…';
 document.getElementById('cancel-generation').hidden=false;
 document.getElementById('step-navigation').hidden=true;
 generationState('Photo uploaded!','Getting ready to create your 2035 hairstyle.');
 const heading=document.getElementById('generation-title');heading.tabIndex=-1;heading.focus({preventScroll:true});window.scrollTo({top:0,behavior:'instant'});
}
async function preparePreviews(file,current){
 if(generationAbort)return;
 const controller=new AbortController();generationAbort=controller;const isCurrent=()=>!controller.signal.aborted&&version===current;
 showGenerationScreen();await refreshServiceConfig();if(!isCurrent())return;lastPhotoFile=file;if(liveConfig.unavailable){generationState('Oops, we couldn’t connect.','Your photo is ready, but the image service is unavailable. Please go back and try again.',true);document.getElementById('generation-message').textContent='No generation has started.';document.getElementById('cancel-generation').hidden=true;generationAbort=null;return}if(!liveConfig.ready){generationAbort=null;document.getElementById('generation-progress').hidden=true;reveal();return}
 const progress=document.getElementById('generation-progress'),message=document.getElementById('generation-message'),meter=document.getElementById('generation-meter');progress.hidden=false;document.getElementById('cancel-generation').hidden=false;meter.value=0;message.textContent='Preparing your 2035 hairstyle…';document.getElementById('reveal').disabled=true;
 let ownedJob=null;let failed=false;const pendingURLs=[];
 try{const prepared=await normalisePhoto(file);if(!isCurrent())return;await api('/api/session',{method:'POST',signal:controller.signal});const form=new FormData();form.set('photo',prepared,'portrait.png');form.set('collection',mode);const created=await api('/api/jobs',{method:'POST',body:form,signal:controller.signal});ownedJob=created.id;generationJob=ownedJob;generationState('Photo uploaded!','Creating your 2035 hairstyle. Your look will appear here automatically.');
  while(isCurrent()){
   const state=await api('/api/jobs/'+ownedJob,{signal:controller.signal});meter.value=state.completed;generationState(state.status==='queued'?'You’re in the queue!':'Your 2035 look is loading…',state.status==='queued'?'Photo uploaded · Position '+state.queuePosition+' in line. We’ll start automatically when a spot opens.':(state.completed?'Your 2035 look is ready.':'Photo uploaded · Creating your 2035 hairstyle.'));message.textContent=state.status==='queued'?'You’re in line · Queue position '+state.queuePosition+' · Your look will start automatically.':(state.completed?'Your 2035 look is ready':'Creating your 2035 hairstyle…');
   for(let i=liveImages.length;i<state.images.length;i++){
    const image=state.images[i];if(!image.url.startsWith('/api/jobs/'+ownedJob+'/images/'))throw Error('Invalid preview location.');
    const response=await fetch(image.url,{credentials:'same-origin',signal:controller.signal});if(!response.ok)throw Error('Preview unavailable.');
    const url=URL.createObjectURL(await response.blob());pendingURLs.push(url);const check=new Image();check.src=url;await check.decode();if(!isCurrent())break;
    liveImages.push(url);pendingURLs.pop();unlockedLooks.add(i);
    const first=liveImages.length===1;if(first){revealed=true;chosen=0;showStep(2);document.getElementById('step-navigation').before(progress);}
    renderCards();select(chosen);document.getElementById('reveal-count').textContent='Your 2035 look is ready';
    if(currentStep===2)document.getElementById('step-next').hidden=false;
    document.querySelector('[data-export="collage"]').disabled=liveImages.length!==1;
   }
   if(state.status==='failed')throw Error(state.error||'Generation stopped. Completed looks remain available.');
   if(state.status==='complete'){if(liveImages.length!==1)throw Error('Your preview was not returned.');return;}
   await new Promise((resolve,reject)=>{const abort=()=>{clearTimeout(timer);reject(new DOMException('Cancelled','AbortError'))};const timer=setTimeout(()=>{controller.signal.removeEventListener('abort',abort);resolve()},1500);controller.signal.addEventListener('abort',abort,{once:true})});
  }
 }catch(e){if(isCurrent()){failed=true;generationState('Oops, a little hair hiccup.',liveImages.length?'Your finished looks are still available below.':'Your photo was received, but we couldn’t finish your looks. Go back to try again.',true);message.textContent=(e.message||'Generation stopped.')+(liveImages.length?' Completed previews remain available.':'');document.getElementById('photo-error').textContent=e.message||'Generation stopped.';document.getElementById('cancel-generation').hidden=true;}}
 finally{pendingURLs.forEach(url=>URL.revokeObjectURL(url));if(ownedJob)fetch('/api/jobs/'+ownedJob,{method:'DELETE',headers:apiHeaders,credentials:'same-origin',keepalive:true}).catch(()=>{});if(generationJob===ownedJob)generationJob=null;if(generationAbort===controller){generationAbort=null;progress.hidden=!failed;document.getElementById('reveal').disabled=false}}
}
document.addEventListener('DOMContentLoaded',async()=>{const upload=document.getElementById('upload'),camera=document.getElementById('camera');upload.disabled=camera.disabled=true;await configReady;upload.disabled=camera.disabled=false;
 updateServiceNotice();
 document.getElementById('generation-back').onclick=()=>{resetGeneration();showStep(1);document.getElementById('upload').value='';document.getElementById('camera').value='';document.getElementById('photo-error').textContent='Please choose your photo again when you’re ready.'};
 document.getElementById('cancel-generation').onclick=()=>{const file=lastPhotoFile;resetGeneration();lastPhotoFile=file;showStep(1);document.getElementById('photo-error').textContent='Generation cancelled. Requests already sent may still be chargeable.'};
 document.getElementById('step-back').addEventListener('click',()=>{if(generationAbort&&currentStep<2)resetGeneration()});
});
