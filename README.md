# Nido

App privata di coppia: chat, foto/video/vocali a visione singola, calendario condiviso, orario delle lezioni, cose da fare.

- Tutti i contenuti sono cifrati sul telefono (AES-256-GCM, chiave derivata dalla frase segreta con PBKDF2) prima di arrivare al server.
- Backend: Supabase (auth, tabella `docs`, bucket privato `media`, realtime). Lo schema è in `supabase-setup.sql`.
- Accesso limitato ai primi due account (funzione `join_nido`).
- Hosting: GitHub Pages, file statici nella radice del repository.

Per modificare l'app si lavora su `src/app-src.html` e si rigenera `index.html` con:

```
python3 src/build.py <SUPABASE_URL> <ANON_KEY>
```
(lanciato dalla cartella `src`, scrive in `site/`; copiare poi i file nella radice)
