import './online.css';
import { GOD_ORDER, GodId } from './engine/gods';
import { fitStage } from './ui/dom';
import { boot, godIntro } from './ui/screens';

fitStage();
window.addEventListener('resize', fitStage);

// ?mac=<tanrı> ile doğrudan o tanrının masasına otur (hızlı test için)
const quick = new URLSearchParams(location.search).get('mac') as GodId | null;
if (quick && GOD_ORDER.includes(quick)) godIntro(quick);
else boot();
