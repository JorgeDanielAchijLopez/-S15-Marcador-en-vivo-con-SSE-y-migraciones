@echo off
setlocal
cd /d "%~dp0"
echo ============================================
echo  PUBLICAR MARCADOR LIVE - SEMANA 15
 echo ============================================
where git >nul 2>&1
if errorlevel 1 (
  echo ERROR: No se encuentra Git. Instala Git o abre Git Bash.
  pause
  exit /b 1
)
if not exist package.json (
  echo ERROR: No se encontro package.json en esta carpeta.
  pause
  exit /b 1
)
if not exist backend\drizzle\0000_initial.sql (
  echo ERROR: Faltan migraciones. Cancelo la publicacion.
  pause
  exit /b 1
)
git init
if errorlevel 1 goto fail
git add .
if errorlevel 1 goto fail
git diff --cached --quiet
if errorlevel 1 (
  git commit -m "feat: marcador de futbol SSE, Drizzle y evidencias S15"
  if errorlevel 1 goto fail
) else (
  echo No hay cambios nuevos para confirmar.
)
git branch -M main
if errorlevel 1 goto fail
git remote get-url origin >nul 2>&1
if errorlevel 1 (
  git remote add origin https://github.com/JorgeDanielAchijLopez/-S15-Marcador-en-vivo-con-SSE-y-migraciones.git
) else (
  git remote set-url origin https://github.com/JorgeDanielAchijLopez/-S15-Marcador-en-vivo-con-SSE-y-migraciones.git
)
if errorlevel 1 goto fail
git push -u origin main
if errorlevel 1 goto fail
echo.
echo ============================================
echo SUBIDA COMPLETADA
 echo https://github.com/JorgeDanielAchijLopez/-S15-Marcador-en-vivo-con-SSE-y-migraciones
 echo ============================================
pause
exit /b 0
:fail
echo.
echo ERROR: La publicacion no se completo. Copia el mensaje y envialo.
pause
exit /b 1
