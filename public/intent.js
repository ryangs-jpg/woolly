// Small, deterministic search hints: no model call or extra dependency.
const subjects=[
 ['감귤',/감귤|귤|tangerine|mandarin/i,'tangerine'],['현무암',/현무암|basalt/i,'basalt'],
 ['돌담',/돌담|stone wall/i,'stone wall'],['돌문화',/돌문화|stone park/i,'stone park'],
 ['해녀',/해녀|haenyeo/i,'haenyeo'],['성산',/성산|seongsan/i,'Seongsan'],
 ['한라산',/한라산|hallasan/i,'Hallasan'],['오름',/오름|oreum/i,'oreum'],
 ['바다',/바다|해안|물결|파도|해변|\bsea\b|coast|beach/i,'sea'],
 ['폭포',/폭포|waterfall/i,'waterfall'],['숲',/숲|삼림|forest/i,'forest'],
 ['꽃',/꽃|유채|flower/i,'flower'],['카페',/카페|커피|cafe|coffee/i,'cafe'],
 ['박물관',/박물관|museum/i,'museum'],['미술관',/미술관|gallery/i,'art museum'],
 ['음식',/음식|맛집|식당|food/i,'food'],['숙소',/숙소|펜션|호텔|민박|hotel/i,'hotel']
];
const moods=[['차분',/차분|잔잔|고요|편안/],['감성',/감성|감성적/],['따뜻',/따뜻|포근/],['고급',/고급|세련/],['활기',/활기|신나|역동/]];
const media=[['영상',/영상|릴스|숏츠|필름|동영상|video|reel/i],['포스터',/포스터|전단|행사|poster/i],['홍보',/홍보|광고|소개/],['브랜딩',/브랜드|브랜딩|로고/],['폰트',/폰트|서체|글자|한글|타이포/],['모션',/모션|애니메이션|움직임/],['패키지',/패키지|포장/]];
export function searchIntent(value=''){
 const query=String(value).normalize('NFC').trim().slice(0,500),found=subjects.filter(([,re])=>re.test(query));
 const style=moods.filter(([,re])=>re.test(query)).map(([name])=>name),formats=media.filter(([,re])=>re.test(query)).map(([name])=>name);
 const inferred=[];
 if(!found.length){
  if(/힐링|휴식|자연|숲길/.test(query))inferred.push(subjects.find(([name])=>name==='숲'));
  else if(style.length||formats.includes('영상')||/여행|관광|풍경/.test(query))inferred.push(subjects.find(([name])=>name==='바다'));
 }
 const chosen=found.length?found:inferred;
 const english=query.replace(/[^a-zA-Z\s]/g,' ').trim().split(/\s+/).filter(x=>x.length>2&&!/^(jeju|reference|design)$/i.test(x)).slice(0,3);
 const terms=chosen.map(([, ,word])=>word);
 const effectiveQuery=['Jeju',...(terms.length?terms:english)].join(' ');
 const expanded=[...chosen.map(([name])=>name),...style,...formats];
 if(formats.some(x=>['홍보','포스터','브랜딩','패키지','폰트'].includes(x)))expanded.push('한글','폰트');
 if(formats.some(x=>['영상','모션'].includes(x)))expanded.push('모션','자막','바다');
 if(found.some(([name])=>name==='카페'))expanded.push('공간','따뜻');
 return {query,subjects:found.map(([name])=>name),inferred:inferred.map(([name])=>name),styles:style,media:formats,terms:[...new Set(expanded)],effectiveQuery,tourismKeyword:chosen[0]?.[0]||'제주',recognized:!!(chosen.length||formats.length||style.length)};
}
