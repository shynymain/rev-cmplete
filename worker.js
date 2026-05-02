const headers={
  'content-type':'application/json;charset=utf-8',
  'access-control-allow-origin':'*',
  'access-control-allow-methods':'GET,POST,OPTIONS',
  'access-control-allow-headers':'content-type'
};
const json=(obj,status=200)=>new Response(JSON.stringify(obj,null,2),{status,headers});
const todayJst=()=>new Date(Date.now()+9*3600*1000).toISOString().slice(0,10);
function sampleHorses(n=14){
  const names=['ラインファイブ','ミドルスター','サンライズ軸','トウカイロード','ファイブリンク','メイショウテン','アドマイヤ隣','グランライン','サクラコード','ブルーム◎','ノースゲート','キングパルス','レッドシフト','スターリング','オメガロード','ディープノート'];
  return Array.from({length:n},(_,i)=>({frame:String(Math.floor(i/2)+1),no:String(i+1),name:names[i]||`サンプル${i+1}`,last1:String((i*3+1)%10||1),last2:String((i*5+4)%10||4),last3:String((i*7+9)%10||9),odds:String((2.1+i*1.7).toFixed(1))}));
}
function makeSchedule(){
  const base=todayJst().replaceAll('-','/');
  const races=[
    ['東京','11','メイステークス','OP','芝','1800m',14],['東京','12','4歳以上2勝クラス','2勝','芝','1400m',16],
    ['京都','10','朱雀ステークス','3勝','芝','1200m',15],['京都','11','京都新聞杯','G2','芝','2200m',13],
    ['新潟','11','谷川岳ステークス','L','芝','1600m',14]
  ];
  return races.map((x,idx)=>({id:`${base}_${x[0]}_${x[1]}`,race:{date:base,place:x[0],raceNo:x[1],raceName:x[2],grade:x[3],condition:'3歳以上',surface:x[4],age:'3歳以上',distance:x[5],headcount:String(x[6])},horses:sampleHorses(x[6])}));
}
function makeResults(races){
  return (races&&races.length?races:makeSchedule()).map((r,i)=>({id:r.id,race:r.race,result:{firstNo:'5',secondNo:'8',thirdNo:'14',umaren:'5-8',umarenPay:String(1200+i*300),sanrenpuku:'5-8-14',sanrenpukuPay:String(4800+i*900)}}));
}
async function advice(env,body){
  const a=body.analysis||{};
  const prompt=`あなたは競馬予想ルール分析チームです。以下の保存レース分析を基に、勝っている条件、負けている条件、軸選定、馬連、3連複、見送り条件、予想ルール見直し案を日本語で短く返してください。JSONのみ。\n質問:${body.question||''}\n分析:${JSON.stringify(a)}\n`;
  if(env.AI){
    try{
      const res=await env.AI.run('@cf/meta/llama-3.1-8b-instruct',{messages:[{role:'system',content:'必ずJSONだけで返す。キーは confidence, summary, winningConditions, losingConditions, ruleAdvice, betAdvice。'},{role:'user',content:prompt}]});
      const text=res.response||res.text||JSON.stringify(res);
      return {ok:true,advice:text};
    }catch(e){return {ok:true,advice:JSON.stringify(fallbackAdvice(a,'AI binding error: '+e.message),null,2)}}
  }
  return {ok:true,advice:JSON.stringify(fallbackAdvice(a,'AI未設定のためローカル分析'),null,2)};
}
function fallbackAdvice(a,note){return {confidence:(a.count||0)>=30?'中':'低',summary:`${note}。対象${a.count||0}R、回収率${a.roi||0}%、軸1着率${a.axisWinRate||0}%です。`,winningConditions:['S型で5系接続が多いレースを優先','軸が中位人気でscore上位の時を重視'],losingConditions:['B型・印1頭以下は見送り継続','結果前や投資0は回収率集計から除外'],ruleAdvice:['S型だけ抽出して回収率を確認','軸1着率が低い条件は馬連中心に下げる','3連複はS型のみ最大6点'],betAdvice:['馬連3点を基本','3連複は高自信度のみ']};}
export default{async fetch(request,env){
  if(request.method==='OPTIONS')return json({ok:true});
  const url=new URL(request.url);
  try{
    if(url.pathname==='/api/health')return json({ok:true,name:'rev-full-auto-worker',date:todayJst(),routes:['/api/schedule','/api/results','/api/advice']});
    if(url.pathname==='/api/schedule')return json({ok:true,source:'sample-jra-style',races:makeSchedule()});
    if(url.pathname==='/api/results'){
      const body=request.method==='POST'?await request.json().catch(()=>({})):{};
      return json({ok:true,source:'sample-result-style',races:makeResults(body.races||[])});
    }
    if(url.pathname==='/api/advice'){
      const body=request.method==='POST'?await request.json().catch(()=>({})):{};
      return json(await advice(env,body));
    }
    return json({ok:false,error:'not found',routes:['/api/health','/api/schedule','/api/results','/api/advice']},404);
  }catch(e){return json({ok:false,error:String(e.stack||e.message||e)},500)}
}};
