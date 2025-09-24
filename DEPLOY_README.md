# 777SolSlot — Quick deploy + local-backend dev instructions

This README contains exact commands to push the frontend to GitHub, deploy to Cloudflare Pages, run the backend locally and expose it via `cloudflared` quick tunnel, and connect the Pages frontend to the local backend using a runtime override.

---

## 1) Commit & push current frontend (Windows PowerShell)
Assuming your frontend folder is at:
`C:\Users\maldi\Desktop\SOLOTOMANIA_CLEAN\frontend`

Open PowerShell and run:

```powershell
cd C:\Users\maldi\Desktop\SOLOTOMANIA_CLEAN\frontend

# initialize git repo (run once if not already a repo)
git init
git branch -M main

# create .gitignore if not present (recommended)
echo "node_modules" > .gitignore
echo ".next" >> .gitignore
echo "package-lock.json" >> .gitignore

# add files, commit
git add .
git commit -m "Frontend ready for Cloudflare Pages - updated script.js and visuals"

# create GitHub repo manually via GitHub UI (name it e.g. "777solslot-frontend")
# then add the remote (replace <your-repo-url>):
git remote add origin <your-repo-url>
git push -u origin main
