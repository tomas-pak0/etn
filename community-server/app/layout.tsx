import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata={title:'ETN · Tyrinėtojai',description:'ETN tyrinėtojų paskyra ir kiekvienos šalies tyrinėjimo reitingas.',icons:{icon:'/favicon.svg'}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="lt"><body><header><a className="brand" href="/"><span className="logo">E<span>·</span></span><span><strong>ETN</strong><small>Explore the Neighborhood</small></span></a><a href="/account">Paskyra / Account</a></header><main>{children}</main><footer>ETN v0.7.0 · © TyliaiTPk · 2026 <a href="/privacy">Privatumas / Privacy</a></footer></body></html>;}
