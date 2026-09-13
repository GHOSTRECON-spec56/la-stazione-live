import QRCode from 'qrcode';
import fs from 'node:fs/promises';
await fs.mkdir('public/menu',{recursive:true});
await QRCode.toFile('public/menu/qr.svg','https://lastazionelb.com/menu/',{type:'svg',errorCorrectionLevel:'H',margin:4,width:1000,color:{dark:'#173d31',light:'#ffffff'}});
await QRCode.toFile('public/menu/qr.png','https://lastazionelb.com/menu/',{type:'png',errorCorrectionLevel:'H',margin:4,width:1600,color:{dark:'#173d31',light:'#ffffff'}});
console.log('Print QR generated for https://lastazionelb.com/menu/');
