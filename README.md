
##frontend server
npm run dev
port 3000

##backend server
npm start
port 5000

database mongodb 

backend `.env` values (recommended):

```
JWT_SECRET=replace-with-a-long-random-secret
JWT_EXPIRES_IN=7d
```

### Password policy
All accounts must use a secure password matching the following rules:

- At least 8 characters long
- Contains at least one uppercase letter
- Contains at least one lowercase letter
- Contains at least one number
- Contains at least one special character (e.g. `!@#$%^&*`)

The frontend validates this during signup and when developers create users; the backend enforces it and will return an error if the rules are not satisfied. Users must also re‑enter their password to confirm it when creating an account.

## mobile/ngrok setup
create `.env` in `unimanage/`:

```
VITE_ALLOWED_HOSTS=gratulatory-grievedly-florence.ngrok-free.dev
VITE_BACKEND_PROXY_TARGET=http://127.0.0.1:5000
```

then restart frontend:

```
npm run dev
```

for ngrok on mobile, expose frontend only:

```
ngrok http 3000
```

backend calls will go through `/api` proxy automatically.
