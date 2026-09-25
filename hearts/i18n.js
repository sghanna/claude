/* All on-screen words, in English, Spanish and Vietnamese.
   Spanish and Vietnamese are Claude's translations and should be checked by a native speaker. */
(function (root) {
  'use strict';

  const STR = {
    en: {
      heartsBroken: 'Hearts are broken', queenPlayed: 'Queen of spades played: 13 points',
      takesQueen: '{name} takes the queen, <em>{pts}</em>', youTakeQueen: 'You take the queen, <em>{pts}</em>',
      celClean: 'Clean hand! No points.', celMoon: 'You shot the moon!', celWin: 'You win!',
      statGames: 'Games you have won: {w} of {n}', statBest: 'Your best final score: {n}', statNewBest: 'New personal best!',
      langName: 'English', title: 'Hearts', help: 'Help', menu: 'Menu',
      names: ['You', 'Michael', 'Jerry', 'Barbara'], pts: '{n} pts', pt1: '1 pt',
      none: 'No {suits}', passTo: 'Pass to', from: 'From', yourCard: 'Your<br>card', takeBack: 'Tap a card to take it back',
      tagLed: 'Led', tagWinning: 'Winning', tagTakes: 'Takes it', tagChosen: 'Chosen', tagNew: 'New',
      choose3: 'Choose <em>3 cards</em> for {name}', chooseMore: 'Choose <em>{n} more</em> for {name}', readyPass: 'Ready to pass to {name}',
      limit: 'You have 3. Tap one to put it back.',
      passedYou: '{name} passed you <em>3 cards</em>', pressContinue: 'Press Continue to start playing.',
      lead2C: 'You lead: play the <em>2 of clubs</em>', leadAny: 'Your turn: lead any card', leadNoHearts: 'Your turn: lead (no hearts yet)',
      follow: 'Your turn: play <em>{suit1}</em>', voidAny: 'No {suits}: play any card', voidFirst: 'No clubs: no points on trick 1',
      mustFollow: 'You must follow {suits}.', noHeartsLead: "Hearts can't be led yet.", noPointsFirst: 'No points on the first trick.',
      mustLead2C: 'Start with the 2 of clubs.', waitFor: 'Wait for {name}.', playing: '{name} is playing',
      takesTrick: '{name} takes the trick, <em>{pts}</em>', youTake: 'You take the trick, <em>{pts}</em>',
      noPoints: 'no points', onePoint: '1 point', nPoints: '{n} points',
      btnPassCount: 'Pass {dir}: {n} of 3 chosen', btnPass: 'Pass these 3 to {name}', btnContinue: 'Continue',
      btnChoose: 'Choose a card to play', btnPlay: 'Play the {card}', btnWait: 'Waiting for {name}',
      btnNextTrick: 'Next trick', btnNextHand: 'Next hand', btnPlayAgain: 'Play again', btnResults: 'See the scores',
      dir: { left: 'left', right: 'right', across: 'across' },
      handEnd: 'End of hand {n}', thisHand: 'This hand', total: 'Total',
      moonYou: 'You shot the moon! Everyone else gets 26.', moonOther: '{name} shot the moon! Everyone else gets 26.',
      nextPass: 'Next hand: pass {dir}.', nextHold: 'Next hand: no passing.',
      winYou: 'You win!', winOther: '{name} wins!', winTie: '{names} tie for the win!', and: ' and ', gameOver: 'Game over',
      mLast: 'Last trick', mScores: 'Scores', mHelp: 'How to play', mSettings: 'Settings', mBack: 'Back to the game', mNew: 'Start a new game',
      newTitle: 'Start a new game?', newBody: "Everyone's score goes back to zero and this hand is thrown in.",
      keep: 'Keep playing', yesNew: 'Yes, start over',
      lastNone: 'No tricks yet this hand.', tookIt: '{name} took it', close: 'Close',
      lastHand: 'Last hand', handNo: 'Hand {n}', scoreNote: 'The game ends when someone reaches 100. Low score wins.',
      speed: 'Game speed', slow: 'Slow', normal: 'Normal', sound: 'Sound', on: 'On', off: 'Off', language: 'Language', done: 'Done',
      gotIt: 'Got it', rotate: 'Please turn your phone upright to play.',
      restoreFail: 'The saved game could not be opened, so a new game started.',
      mNames: 'Name your opponents',
      promise1: 'Give the other three players any names you like. The game itself stays the same.',
      promise2: 'To turn this on, we ask one thing: please donate to a school in your neighborhood. You can choose any school you like.',
      promise3: 'There is nothing to pay here. We trust you to do it.',
      promiseYes: 'I promise to donate', notNow: 'Not now', namesThanks: 'Thank you for supporting a school!',
      seatLeft: 'On your left', seatAcross: 'Across from you', seatRight: 'On your right',
      namesNote: 'Up to {n} letters each.', saveNames: 'Save names', usualNames: 'Use the usual names', cancel: 'Cancel',
      rules: [
        'Each hand, choose 3 cards to pass: left, then right, then across, then a hand with no passing.',
        'Your cards sit in four rows: clubs, diamonds, spades, hearts.',
        'Tap a card to choose it. Tap it again to put it back. Nothing happens until you press the big button at the bottom.',
        'The 2 of clubs starts. Play the suit that was led if you have one.',
        "Hearts can't be led until someone has played one.",
        'Each heart you take is 1 point. The queen of spades is 13.',
        'Take all 26 points and everyone else gets 26 instead ("shooting the moon").',
        'The numbers by each name are game totals. A red +3 means points taken this hand.',
        'The game ends when someone reaches 100. Low score wins.'
      ],
      rank: { A: 'ace', K: 'king', Q: 'queen', J: 'jack' },
      suits: { C: 'clubs', D: 'diamonds', S: 'spades', H: 'hearts' },
      suit1: { C: 'a club', D: 'a diamond', S: 'a spade', H: 'a heart' },
      card: (r, s) => `${r} of ${s}`
    },
    es: {
      heartsBroken: 'Ya se rompieron los corazones', queenPlayed: 'Salió la reina de picas: 13 puntos',
      takesQueen: '{name} gana la reina, <em>{pts}</em>', youTakeQueen: 'Ganas la reina, <em>{pts}</em>',
      celClean: '¡Mano limpia! Sin puntos.', celMoon: '¡Tiro a la luna!', celWin: '¡Ganaste!',
      statGames: 'Juegos ganados: {w} de {n}', statBest: 'Tu mejor puntuación final: {n}', statNewBest: '¡Nuevo récord personal!',
      langName: 'Español', title: 'Corazones', help: 'Ayuda', menu: 'Menú',
      names: ['Tú', 'Michael', 'Jerry', 'Barbara'], pts: '{n} pts', pt1: '1 pt',
      none: 'Sin {suits}', passTo: 'Pasar a', from: 'De', yourCard: 'Tu<br>carta', takeBack: 'Toca una carta para devolverla',
      tagLed: 'Abrió', tagWinning: 'Gana', tagTakes: 'Ganó', tagChosen: 'Elegida', tagNew: 'Nueva',
      choose3: 'Elige <em>3 cartas</em> para {name}', chooseMore: 'Elige <em>{n} más</em> para {name}', readyPass: 'Listo para pasar a {name}',
      limit: 'Ya tienes 3. Toca una para devolverla.',
      passedYou: '{name} te pasó <em>3 cartas</em>', pressContinue: 'Pulsa Continuar para empezar.',
      lead2C: 'Tú abres: juega el <em>2 de tréboles</em>', leadAny: 'Tu turno: abre con cualquier carta', leadNoHearts: 'Tu turno: abre (sin corazones aún)',
      follow: 'Tu turno: juega <em>{suits}</em>', voidAny: 'Sin {suits}: juega cualquier carta', voidFirst: 'Sin tréboles: nada de puntos',
      mustFollow: 'Debes jugar {suits}.', noHeartsLead: 'Aún no se puede abrir con corazones.', noPointsFirst: 'Nada de puntos en la primera baza.',
      mustLead2C: 'Empieza con el 2 de tréboles.', waitFor: 'Espera a {name}.', playing: 'Juega {name}',
      takesTrick: '{name} gana la baza, <em>{pts}</em>', youTake: 'Ganas la baza, <em>{pts}</em>',
      noPoints: 'sin puntos', onePoint: '1 punto', nPoints: '{n} puntos',
      btnPassCount: 'Pasar {dir}: {n} de 3', btnPass: 'Pasar estas 3 a {name}', btnContinue: 'Continuar',
      btnChoose: 'Elige una carta', btnPlay: 'Jugar {card}', btnWait: 'Esperando a {name}',
      btnNextTrick: 'Siguiente baza', btnNextHand: 'Siguiente mano', btnPlayAgain: 'Jugar otra vez', btnResults: 'Ver puntuación',
      dir: { left: 'a la izquierda', right: 'a la derecha', across: 'al frente' },
      handEnd: 'Fin de la mano {n}', thisHand: 'Esta mano', total: 'Total',
      moonYou: '¡Tiro a la luna! Los demás reciben 26.', moonOther: '¡{name} hizo el tiro a la luna! Los demás reciben 26.',
      nextPass: 'Próxima mano: pasar {dir}.', nextHold: 'Próxima mano: sin pasar cartas.',
      winYou: '¡Ganaste!', winOther: '¡Gana {name}!', winTie: '¡{names} empatan y ganan!', and: ' y ', gameOver: 'Fin del juego',
      mLast: 'Última baza', mScores: 'Puntuación', mHelp: 'Cómo jugar', mSettings: 'Ajustes', mBack: 'Volver al juego', mNew: 'Empezar un juego nuevo',
      newTitle: '¿Empezar un juego nuevo?', newBody: 'Todos los puntos vuelven a cero y esta mano se pierde.',
      keep: 'Seguir jugando', yesNew: 'Sí, empezar de nuevo',
      lastNone: 'Aún no hay bazas en esta mano.', tookIt: 'La ganó {name}', close: 'Cerrar',
      lastHand: 'Última mano', handNo: 'Mano {n}', scoreNote: 'El juego termina cuando alguien llega a 100. Gana quien tenga menos puntos.',
      speed: 'Velocidad', slow: 'Lenta', normal: 'Normal', sound: 'Sonido', on: 'Sí', off: 'No', language: 'Idioma', done: 'Listo',
      gotIt: 'Entendido', rotate: 'Pon el teléfono en vertical para jugar.',
      restoreFail: 'No se pudo abrir la partida guardada; empezó una nueva.',
      mNames: 'Nombrar a los rivales',
      promise1: 'Pon a los otros tres jugadores los nombres que quieras. El juego sigue igual.',
      promise2: 'Para activarlo te pedimos una cosa: por favor, haz una donación a una escuela de tu barrio. Puedes elegir la escuela que quieras.',
      promise3: 'Aquí no se paga nada. Confiamos en que lo harás.',
      promiseYes: 'Prometo donar', notNow: 'Ahora no', namesThanks: '¡Gracias por apoyar a una escuela!',
      seatLeft: 'A tu izquierda', seatAcross: 'Enfrente de ti', seatRight: 'A tu derecha',
      namesNote: 'Hasta {n} letras cada uno.', saveNames: 'Guardar nombres', usualNames: 'Volver a los nombres de siempre', cancel: 'Cancelar',
      rules: [
        'En cada mano eliges 3 cartas para pasar: a la izquierda, a la derecha, al frente y luego una mano sin pasar.',
        'Tus cartas están en cuatro filas: tréboles, diamantes, picas y corazones.',
        'Toca una carta para elegirla. Tócala otra vez para devolverla. No pasa nada hasta que pulses el botón grande de abajo.',
        'Empieza el 2 de tréboles. Juega el palo que salió si lo tienes.',
        'No se puede abrir con corazones hasta que alguien juegue uno.',
        'Cada corazón que ganas vale 1 punto. La reina de picas vale 13.',
        'Si ganas los 26 puntos, los demás reciben 26 ("tiro a la luna").',
        'Los números junto a cada nombre son el total del juego. Un +3 rojo son los puntos de esta mano.',
        'El juego termina cuando alguien llega a 100. Gana quien tenga menos puntos.'
      ],
      rank: { A: 'as', K: 'rey', Q: 'reina', J: 'jota' },
      suits: { C: 'tréboles', D: 'diamantes', S: 'picas', H: 'corazones' },
      suit1: { C: 'tréboles', D: 'diamantes', S: 'picas', H: 'corazones' },
      card: (r, s) => `${r} de ${s}`,
      article: r => (r === 'reina' || r === 'jota' ? 'la' : 'el')
    },
    vi: {
      heartsBroken: 'Đã có người đánh cơ', queenPlayed: 'Đầm bích đã ra: 13 điểm',
      takesQueen: '{name} ăn Đầm bích, <em>{pts}</em>', youTakeQueen: 'Bạn ăn Đầm bích, <em>{pts}</em>',
      celClean: 'Ván sạch! Không điểm.', celMoon: 'Bạn đã ăn hết điểm!', celWin: 'Bạn thắng!',
      statGames: 'Số trò chơi đã thắng: {w}/{n}', statBest: 'Điểm cuối tốt nhất: {n}', statNewBest: 'Kỷ lục mới!',
      langName: 'Tiếng Việt', title: 'Hearts', help: 'Trợ giúp', menu: 'Menu',
      names: ['Bạn', 'Michael', 'Jerry', 'Barbara'], pts: '{n} điểm', pt1: '1 điểm',
      none: 'Hết {suits}', passTo: 'Chuyền cho', from: 'Từ', yourCard: 'Lá<br>của bạn', takeBack: 'Chạm vào lá bài để lấy lại',
      tagLed: 'Đi đầu', tagWinning: 'Cao nhất', tagTakes: 'Ăn vòng', tagChosen: 'Đã chọn', tagNew: 'Mới',
      choose3: 'Chọn <em>3 lá</em> cho {name}', chooseMore: 'Chọn thêm <em>{n} lá</em> cho {name}', readyPass: 'Sẵn sàng chuyền cho {name}',
      limit: 'Đã đủ 3 lá. Chạm một lá để bỏ chọn.',
      passedYou: '{name} chuyền cho bạn <em>3 lá</em>', pressContinue: 'Nhấn Tiếp tục để bắt đầu chơi.',
      lead2C: 'Bạn đi trước: đánh lá <em>2 chuồn</em>', leadAny: 'Đến lượt bạn: đi lá bất kỳ', leadNoHearts: 'Đến lượt bạn: đi (chưa được đi cơ)',
      follow: 'Đến lượt bạn: đánh <em>{suit1}</em>', voidAny: 'Hết {suits}: đánh lá bất kỳ', voidFirst: 'Hết chuồn: vòng đầu không đánh điểm',
      mustFollow: 'Bạn phải đánh {suits}.', noHeartsLead: 'Chưa được đi cơ.', noPointsFirst: 'Vòng đầu không được đánh lá có điểm.',
      mustLead2C: 'Hãy đi lá 2 chuồn trước.', waitFor: 'Chờ {name}.', playing: '{name} đang đánh',
      takesTrick: '{name} ăn vòng này, <em>{pts}</em>', youTake: 'Bạn ăn vòng này, <em>{pts}</em>',
      noPoints: 'không có điểm', onePoint: '1 điểm', nPoints: '{n} điểm',
      btnPassCount: 'Chuyền {dir}: đã chọn {n}/3', btnPass: 'Chuyền 3 lá này cho {name}', btnContinue: 'Tiếp tục',
      btnChoose: 'Chọn một lá để đánh', btnPlay: 'Đánh lá {card}', btnWait: 'Đang chờ {name}',
      btnNextTrick: 'Vòng tiếp theo', btnNextHand: 'Ván tiếp theo', btnPlayAgain: 'Chơi lại', btnResults: 'Xem điểm',
      dir: { left: 'sang trái', right: 'sang phải', across: 'đối diện' },
      handEnd: 'Hết ván {n}', thisHand: 'Ván này', total: 'Tổng',
      moonYou: 'Bạn đã ăn hết điểm! Mỗi người khác bị cộng 26.', moonOther: '{name} đã ăn hết điểm! Mỗi người khác bị cộng 26.',
      nextPass: 'Ván sau: chuyền {dir}.', nextHold: 'Ván sau: không chuyền bài.',
      winYou: 'Bạn thắng!', winOther: '{name} thắng!', winTie: '{names} hòa và cùng thắng!', and: ' và ', gameOver: 'Hết trò chơi',
      mLast: 'Vòng vừa rồi', mScores: 'Bảng điểm', mHelp: 'Cách chơi', mSettings: 'Cài đặt', mBack: 'Quay lại trò chơi', mNew: 'Bắt đầu trò chơi mới',
      newTitle: 'Bắt đầu trò chơi mới?', newBody: 'Điểm của mọi người trở về 0 và ván này bị hủy.',
      keep: 'Tiếp tục chơi', yesNew: 'Có, chơi lại từ đầu',
      lastNone: 'Ván này chưa có vòng nào.', tookIt: '{name} ăn', close: 'Đóng',
      lastHand: 'Ván trước', handNo: 'Ván {n}', scoreNote: 'Trò chơi kết thúc khi có người đạt 100 điểm. Ai ít điểm nhất thắng.',
      speed: 'Tốc độ', slow: 'Chậm', normal: 'Bình thường', sound: 'Âm thanh', on: 'Bật', off: 'Tắt', language: 'Ngôn ngữ', done: 'Xong',
      gotIt: 'Đã hiểu', rotate: 'Vui lòng xoay điện thoại thẳng đứng để chơi.',
      restoreFail: 'Không mở được ván đã lưu, nên đã bắt đầu ván mới.',
      mNames: 'Đặt tên đối thủ',
      promise1: 'Đặt tên tùy ý cho ba người chơi kia. Cách chơi vẫn giữ nguyên.',
      promise2: 'Để mở tính năng này, chúng tôi chỉ xin một điều: hãy quyên góp cho một trường học trong khu phố của bạn. Bạn có thể chọn bất kỳ trường nào.',
      promise3: 'Ở đây không phải trả tiền. Chúng tôi tin bạn sẽ làm.',
      promiseYes: 'Tôi hứa sẽ quyên góp', notNow: 'Để sau', namesThanks: 'Cảm ơn bạn đã ủng hộ trường học!',
      seatLeft: 'Bên trái bạn', seatAcross: 'Đối diện bạn', seatRight: 'Bên phải bạn',
      namesNote: 'Tối đa {n} ký tự mỗi tên.', saveNames: 'Lưu tên', usualNames: 'Dùng lại tên ban đầu', cancel: 'Hủy',
      rules: [
        'Mỗi ván, chọn 3 lá để chuyền: sang trái, sang phải, đối diện, rồi một ván không chuyền.',
        'Bài của bạn xếp thành bốn hàng: chuồn, rô, bích, cơ.',
        'Chạm vào lá bài để chọn. Chạm lần nữa để bỏ chọn. Chỉ khi bấm nút lớn ở dưới thì mới đánh.',
        'Lá 2 chuồn đi đầu tiên. Phải đánh cùng chất với lá đi đầu nếu có.',
        'Chưa được đi cơ cho đến khi có người đánh cơ.',
        'Mỗi lá cơ ăn được là 1 điểm. Đầm bích là 13 điểm.',
        'Ăn hết 26 điểm thì mỗi người khác bị cộng 26 ("shoot the moon").',
        'Số cạnh mỗi tên là tổng điểm. Số +3 màu đỏ là điểm ăn trong ván này.',
        'Trò chơi kết thúc khi có người đạt 100 điểm. Ai ít điểm nhất thắng.'
      ],
      rank: { A: 'Át', K: 'Già', Q: 'Đầm', J: 'Bồi' },
      suits: { C: 'chuồn', D: 'rô', S: 'bích', H: 'cơ' },
      suit1: { C: 'chuồn', D: 'rô', S: 'bích', H: 'cơ' },
      card: (r, s) => `${r} ${s}`
    }
  };

  const LANGS = Object.keys(STR);
  let lang = 'en', custom = [];

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
    langName: l => STR[l].langName,
    // Names she chose for the other players (Menu, Name your opponents) are kept in every language.
    setNames(list) { custom = Array.isArray(list) ? list : []; },
    name: seat => (seat && custom[seat]) || STR[lang].names[seat],
    defaultName: seat => STR[lang].names[seat],
    suits: s => STR[lang].suits[s],
    suit1: s => STR[lang].suit1[s],
    dir: d => STR[lang].dir[d],
    // "queen of clubs" / "reina de tréboles" / "Đầm chuồn"; withArticle adds "el"/"la" in Spanish.
    card(code, withArticle) {
      const L = STR[lang], r = code.slice(0, -1), s = code.slice(-1);
      const word = L.rank[r] || r;
      const text = L.card(word, L.suits[s]);
      return withArticle && L.article ? L.article(word) + ' ' + text : text;
    },
    list(names) { return names.length < 2 ? names.join('') : names.slice(0, -1).join(', ') + STR[lang].and + names[names.length - 1]; }
  };

  root.I18N = I18N;
})(window);
