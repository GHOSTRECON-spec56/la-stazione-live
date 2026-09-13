# Final V6 launch

The approved beige V6 design is the main homepage at `https://lastazionelb.com/`. Final assets use `/assets/site/`. The permanent QR menu remains `/menu/`, including its existing QR images.

Old `/redesign/` and `/redesign_v1/` through `/redesign_v6/` page addresses redirect permanently to `/`. Specific legacy image/font/art URLs redirect to the stable assets first, keeping saved and cached photo references working. Historical source files remain in Git and behind forced redirects; they do not serve old public pages.

The owner workspace at `/owner/` is locked behind server-verified Google sessions. Only `lastazione10@gmail.com` can manage the editor allowlist. See [owner activation instructions](OWNER-ACCESS.md): the real `GOOGLE_CLIENT_ID` still needs to be configured in the hosting account. All write endpoints fail closed until setup is complete.

Published menu prices and photo collections have not been changed by this launch. Fifteen automated checks cover content persistence, Google verification requirements, session expiry/logout, CSRF, editor revocation and access-list conflicts. Desktop/mobile checks compare the main homepage geometry with the approved V6 and check owner states separately. Real Google sign-in remains unverified until account configuration is supplied.

See [hosting assessment](HOSTING.md) for current and legacy Netlify Free limits, outage behavior and upgrade considerations.
