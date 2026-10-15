import { api } from '../../community';
export const dynamic='force-dynamic';
const handle=async(request:Request,{params}:{params:Promise<{path:string[]}>})=>api(request,(await params).path.join('/'));
export {handle as GET,handle as POST,handle as DELETE,handle as OPTIONS};
