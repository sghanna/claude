/* Word Wheel: all on-screen words, in English, Spanish and Vietnamese. The puzzles themselves stay in English.
   Spanish and Vietnamese are Claude's own translations and need a native speaker's check before they are trusted. */
(function (root) {
  'use strict';

  const STR = {
    en: {
      langName: 'English', title: 'Word Wheel', menu: 'Menu', help: 'Help', level: 'Level {n}',
      back: 'Back', enter: 'Enter', shuffle: 'Shuffle', hint: 'Hint', pick: 'Pick a square',
      left: '{n} words to find', left1: '1 word to find', allFound: 'All words found!',
      need3: 'Words need 3 letters', niceFind: 'Nice find! <em>{word}</em>', already: 'Already found: <em>{word}</em>',
      notHere: 'Not in this puzzle: <em>{word}</em>', tapBlank: 'Tap a blank square', showing: 'That square is showing',
      bonus: 'Bonus {n}',
      levelDone: 'Level {n} complete!', wordsFound: 'Words found: {n}', bonusFound: 'Bonus words found: {n}',
      levelsDone: 'Levels finished so far: {n}', nextLevel: 'Next level',
      lastLevel: 'You finished all {n} levels! The next one is level 1 again.',
      mHelp: 'How to play', mSettings: 'Settings', mGoto: 'Go to a level', mBack: 'Back to the game', mNew: 'Start over from level 1',
      newTitle: 'Start over from level&nbsp;1?', newBody: 'You will go back to level 1, and the levels you reached will need to be played again.',
      keep: 'Keep playing', yesNew: 'Yes, start over',
      gotoTitle: 'Go to a level', gotoBody: 'Choose any level you have reached, from 1 to {n}.', gotoBodyAll: 'Choose any level, from 1 to {n}.', go: 'Go', cancel: 'Cancel',
      less: 'One less', more: 'One more',
      sound: 'Sound', on: 'On', off: 'Off', language: 'Language', done: 'Done', gotIt: 'Got it', ok: 'OK',
      rotate: 'Please turn your phone upright to play.',
      restoreFail: 'Your saved game could not be read, so the game started again from level 1.',
      restorePart: 'Part of your saved game could not be read, so level {n} starts again.',
      wheelLabel: 'Letter wheel', gridLabel: 'Puzzle', stripLabel: 'Your word', blank: 'blank', square: 'Row {r}, column {c}: {v}',
      rules: [
        'Make words from the letters on the wheel. Every word has 3 or more letters, and each letter is used once per word.',
        'Swipe: put your finger on a letter, slide it through the next letters, then lift your finger.',
        'Or tap: tap the letters one at a time, then press Enter. Back takes away the last letter. Tapping the last letter again also takes it away.',
        'A word in the puzzle fills in its squares. Other real words count as bonus words.',
        'Shuffle mixes up the letters on the wheel. It can help you see new words.',
        'Hint shows one letter in the puzzle.',
        'Pick a square: press it, then tap any blank square to see its letter. Press it again to cancel.',
        'Hints are free. There is no timer and nothing to lose.',
        'Find every word to finish the level.'
      ]
    },
    es: {
      langName: 'Español', title: 'Word Wheel', menu: 'Menú', help: 'Ayuda', level: 'Nivel {n}',
      back: 'Borrar', enter: 'Enviar', shuffle: 'Mezclar', hint: 'Pista', pick: 'Elegir casilla',
      left: 'Faltan {n} palabras', left1: 'Falta 1 palabra', allFound: '¡Encontraste todas!',
      need3: 'Usa 3 letras o más', niceFind: '¡Bien hecho! <em>{word}</em>', already: 'Ya la encontraste: <em>{word}</em>',
      notHere: 'No está en este juego: <em>{word}</em>', tapBlank: 'Toca una casilla vacía', showing: 'Esa casilla ya se ve',
      bonus: 'Extra {n}',
      levelDone: '¡Nivel {n} completado!', wordsFound: 'Palabras encontradas: {n}', bonusFound: 'Palabras extra: {n}',
      levelsDone: 'Niveles terminados: {n}', nextLevel: 'Siguiente nivel',
      lastLevel: '¡Terminaste los {n} niveles! El siguiente es otra vez el nivel 1.',
      mHelp: 'Cómo jugar', mSettings: 'Ajustes', mGoto: 'Ir a un nivel', mBack: 'Volver al juego', mNew: 'Empezar desde el nivel 1',
      newTitle: '¿Empezar desde el nivel&nbsp;1?', newBody: 'Volverás al nivel 1 y tendrás que jugar otra vez los niveles que ya alcanzaste.',
      keep: 'Seguir jugando', yesNew: 'Sí, empezar de nuevo',
      gotoTitle: 'Ir a un nivel', gotoBody: 'Elige cualquier nivel que ya alcanzaste, del 1 al {n}.', gotoBodyAll: 'Elige cualquier nivel, del 1 al {n}.', go: 'Ir', cancel: 'Cancelar',
      less: 'Uno menos', more: 'Uno más',
      sound: 'Sonido', on: 'Sí', off: 'No', language: 'Idioma', done: 'Listo', gotIt: 'Entendido', ok: 'Aceptar',
      rotate: 'Pon el teléfono en vertical para jugar.',
      restoreFail: 'No se pudo leer tu juego guardado, así que empezó otra vez en el nivel 1.',
      restorePart: 'Parte de tu juego guardado no se pudo leer, así que el nivel {n} empieza otra vez.',
      wheelLabel: 'Rueda de letras', gridLabel: 'Crucigrama', stripLabel: 'Tu palabra', blank: 'vacía', square: 'Fila {r}, columna {c}: {v}',
      rules: [
        'Las palabras del juego están en inglés.',
        'Forma palabras con las letras de la rueda. Cada palabra tiene 3 letras o más, y cada letra se usa una vez por palabra.',
        'Deslizar: pon el dedo en una letra, deslízalo por las siguientes letras y luego levanta el dedo.',
        'O tocar: toca las letras una por una y luego pulsa Enviar. Borrar quita la última letra. Tocar otra vez la última letra también la quita.',
        'Una palabra del crucigrama llena sus casillas. Otras palabras reales cuentan como palabras extra.',
        'Mezclar cambia el orden de las letras de la rueda. Te puede ayudar a ver palabras nuevas.',
        'Pista muestra una letra del crucigrama.',
        'Elegir casilla: púlsalo y luego toca una casilla vacía para ver su letra. Púlsalo otra vez para cancelar.',
        'Las pistas son gratis. No hay reloj y no se pierde nada.',
        'Encuentra todas las palabras para terminar el nivel.'
      ]
    },
    vi: {
      langName: 'Tiếng Việt', title: 'Word Wheel', menu: 'Menu', help: 'Trợ giúp', level: 'Màn {n}',
      back: 'Xóa', enter: 'Nhập', shuffle: 'Trộn', hint: 'Gợi ý', pick: 'Chọn ô',
      left: 'Còn {n} từ cần tìm', left1: 'Còn 1 từ cần tìm', allFound: 'Đã tìm hết các từ!',
      need3: 'Từ phải có ít nhất 3 chữ', niceFind: 'Hay lắm! <em>{word}</em>', already: 'Đã tìm rồi: <em>{word}</em>',
      notHere: 'Không có trong ô chữ: <em>{word}</em>', tapBlank: 'Chạm vào một ô trống', showing: 'Ô đó đã hiện chữ rồi',
      bonus: 'Thêm {n}',
      levelDone: 'Xong màn {n}!', wordsFound: 'Số từ đã tìm: {n}', bonusFound: 'Số từ thêm: {n}',
      levelsDone: 'Số màn đã xong: {n}', nextLevel: 'Màn tiếp theo',
      lastLevel: 'Bạn đã chơi xong cả {n} màn! Màn tiếp theo lại là màn 1.',
      mHelp: 'Cách chơi', mSettings: 'Cài đặt', mGoto: 'Đến một màn', mBack: 'Quay lại trò chơi', mNew: 'Chơi lại từ màn 1',
      newTitle: 'Chơi lại từ màn&nbsp;1?', newBody: 'Bạn sẽ quay về màn 1 và phải chơi lại các màn đã qua.',
      keep: 'Tiếp tục chơi', yesNew: 'Có, chơi lại',
      gotoTitle: 'Đến một màn', gotoBody: 'Chọn màn bạn đã tới, từ 1 đến {n}.', gotoBodyAll: 'Chọn màn bất kỳ, từ 1 đến {n}.', go: 'Đi', cancel: 'Hủy',
      less: 'Bớt một', more: 'Thêm một',
      sound: 'Âm thanh', on: 'Bật', off: 'Tắt', language: 'Ngôn ngữ', done: 'Xong', gotIt: 'Đã hiểu', ok: 'OK',
      rotate: 'Vui lòng xoay dọc điện thoại để chơi.',
      restoreFail: 'Không đọc được trò chơi đã lưu, nên trò chơi bắt đầu lại từ màn 1.',
      restorePart: 'Một phần trò chơi đã lưu không đọc được, nên màn {n} bắt đầu lại.',
      wheelLabel: 'Vòng chữ', gridLabel: 'Ô chữ', stripLabel: 'Từ của bạn', blank: 'trống', square: 'Hàng {r}, cột {c}: {v}',
      rules: [
        'Các từ trong trò chơi là tiếng Anh.',
        'Ghép từ bằng các chữ cái trên vòng. Mỗi từ có từ 3 chữ trở lên, và mỗi chữ chỉ dùng một lần trong một từ.',
        'Vuốt: đặt ngón tay lên một chữ, trượt qua các chữ tiếp theo, rồi nhấc tay lên.',
        'Hoặc chạm: chạm từng chữ một, rồi bấm Nhập. Xóa bỏ chữ cuối cùng. Chạm lại chữ cuối cùng cũng bỏ chữ đó.',
        'Từ có trong ô chữ sẽ hiện vào các ô. Những từ thật khác được tính là từ thêm.',
        'Trộn đổi chỗ các chữ trên vòng, giúp bạn nhìn ra từ mới.',
        'Gợi ý hiện một chữ trong ô chữ.',
        'Chọn ô: bấm nút này, rồi chạm vào một ô trống để xem chữ trong đó. Bấm lại để hủy.',
        'Gợi ý miễn phí. Không tính giờ và không mất gì cả.',
        'Tìm hết các từ để qua màn.'
      ]
    }
  };

  const LANGS = Object.keys(STR);
  let lang = 'en';

  function fill(text, vars) {
    return String(text).replace(/\{(\w+)\}/g, (m, k) => (vars && k in vars ? vars[k] : m));
  }

  const I18N = {
    LANGS,
    get lang() { return lang; },
    set(l) { lang = LANGS.includes(l) ? l : 'en'; document.documentElement.lang = lang; },
    detect() {
      const prefs = (navigator.languages || [navigator.language || 'en']).map(x => String(x).slice(0, 2).toLowerCase());
      return prefs.find(p => LANGS.includes(p)) || 'en';
    },
    t(key, vars) { const v = STR[lang][key] !== undefined ? STR[lang][key] : STR.en[key]; return typeof v === 'string' ? fill(v, vars) : v; },
    langName: l => STR[l].langName
  };

  root.I18N = I18N;
})(window);
