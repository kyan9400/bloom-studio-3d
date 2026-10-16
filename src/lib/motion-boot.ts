/* Shared by the server layout (inline <head> script) and the client motion store.
   Full motion unless the visitor chose "Reduce motion" (localStorage) or the URL says ?motion=reduced. */

export const MOTION_KEY = "bloom-motion";

export const MOTION_BOOT_SCRIPT = `(function(){try{var d=document.documentElement,q=new URLSearchParams(location.search).get('motion'),s=null;try{s=localStorage.getItem('${MOTION_KEY}')}catch(e){}var c=(q==='full'||q==='reduced')?q:s;var r=c==='reduced';d.classList.toggle('reduce-motion',r)}catch(e){}})();`;
