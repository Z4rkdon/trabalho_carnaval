# 🎭 Hack da Torre de Copos — Carnaval

PWA mobile-first de um jogo de destreza inspirado no truque de colher uma pirâmide de copos. O jogador toca nos copos no ritmo do samba e arrasta para colher a pilha. Cada conquista libera **papercrafts de carnaval em A4** para imprimir, recortar e montar.

## ✨ Funcionalidades

- **Jogo de toque + swipe no ritmo**: pirâmide de 6 copos, anel de tempo, combo, penalidades e bônus de colheita.
- **3 dificuldades**: Ensaio, Bloco e Apoteose.
- **Prêmios reais**: 3 moldes A4 (estandarte, máscara e copo-troféu) em SVG + PDF.
- **Ranking local**: top 10 salvo no aparelho (localStorage).
- **Ajustes**: som, vibração e redução de animações.
- **PWA instalável**: manifest, service worker, ícones, atalhos e funcionamento offline.
- **Acessibilidade**: alvos de toque grandes, foco visível, contraste, suporte a teclado (Enter/Espaço para tocar e ↓ para colher) e `prefers-reduced-motion`.
- **Galeria com prévia ampliada**: clique na miniatura para ver o molde em detalhe, baixar o PDF ou imprimir.
- **Tema de carnaval** com confetes, cores vibrantes e tipografia expressiva.

## ▶️ Como rodar

O service worker exige **HTTPS** ou **localhost**. Na pasta do projeto:

```bash
python3 -m http.server 8080
# abra http://localhost:8080
```

Também funciona em qualquer hospedagem estática (GitHub Pages, Netlify, Vercel, etc.) sem build.

## 📁 Estrutura

```
index.html            Telas (home, jogo, resultado, prêmios, ranking)
manifest.json         Manifesto da PWA
sw.js                 Service worker (cache offline)
css/style.css         Tema carnaval, mobile-first
js/audio.js           Samba e efeitos sintetizados (Web Audio)
js/game.js            Loop do jogo, timing e gestos
js/papercraft.js      Galeria e impressão dos moldes
js/app.js             Navegação, progresso, PWA e ajustes
icons/                Ícones 192/512, maskable, Apple Touch e favicon
papercrafts/          Moldes SVG + PDF A4 e prévias
screenshots/          Capturas usadas no manifesto (PWA)
```

## 🎮 Como jogar

1. Toque no copo que acende antes do anel fechar.
2. Ao limpar uma fileira, **arraste o dedo para baixo** para colher a pilha.
3. Precisão e combo valem pontos. As estrelas (1 a 3) liberam os papercrafts.

**Teclado:** `Tab` para navegar, `Enter`/`Espaço` para tocar no copo e `↓` para colher. `Esc` fecha as janelas.

## 🖨️ Papercrafts

| Prêmio | Estrelas | Molde |
| --- | --- | --- |
| Estandarte do Bloco | 1 | `papercrafts/estandarte.pdf` |
| Máscara da Corte | 2 | `papercrafts/mascara.pdf` |
| Copo-Troféu do Bloco | 3 | `papercrafts/trofeu.pdf` |

Imprima em A4 (papel 180g ou cartolina). Linha cheia = recorte, tracejada = dobra, hachurada = cola.

## 📱 Instalação

- **Android/Chrome**: menu ⋮ → “Instalar aplicativo”.
- **iPhone/iPad/Safari**: Compartilhar → “Adicionar à Tela de Início”.
- **Desktop**: ícone de instalação na barra de endereço.

## 🔧 Notas técnicas

- Sem frameworks nem build; apenas HTML, CSS e JavaScript.
- Áudio 100% sintetizado, sem arquivos externos.
- Cache versionado no service worker: ao alterar arquivos, incremente `VERSION` em `sw.js`.
- Ranking e progresso ficam apenas no dispositivo (privacidade por padrão).
