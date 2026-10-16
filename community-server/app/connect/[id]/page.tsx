import Portal from '../../portal';
export default async function Connect({params,searchParams}:{params:Promise<{id:string}>,searchParams:Promise<{lang?:string}>}){const{id}=await params,{lang}=await searchParams;return <Portal requestId={id} language={lang}/>;}
