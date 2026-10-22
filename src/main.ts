import './online.css';
import { GOD_ORDER, GodId } from './engine/gods';
import { fitStage } from './ui/dom';
import { initMobile } from './ui/mobile';
import { showOnline } from './ui/online';
import { boot, godIntro, showCrossroads } from './ui/screens';

fitStage();
initMobile(fitStage);

const params = new URLSearchParams(location.search);
// ?oda=1234: davet bağlantısı, doğrudan çevrimiçi katılma ekranı
const invite = (params.get('oda') ?? '').replace(/\D/g, '').slice(0, 4);
// ?mac=<tanrı>: doğrudan o tanrının masasına otur (hızlı test için)
const quick = params.get('mac') as GodId | null;

if (invite.length === 4) {
  history.replaceState(null, '', location.pathname);
  showOnline(showCrossroads, invite);
} else if (quick && GOD_ORDER.includes(quick)) godIntro(quick);
else boot();
