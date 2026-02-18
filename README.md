
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
