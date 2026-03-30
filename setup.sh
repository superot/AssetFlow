#!/usr/bin/env bash
set -euo pipefail

# ─────────────────────────────────────────────
#  AssetFlow — Setup Script
# ─────────────────────────────────────────────

BOLD="\033[1m"
GREEN="\033[0;32m"
YELLOW="\033[0;33m"
RED="\033[0;31m"
RESET="\033[0m"

info()    { echo -e "${BOLD}[INFO]${RESET}  $*"; }
success() { echo -e "${GREEN}[OK]${RESET}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${RESET}  $*"; }
error()   { echo -e "${RED}[ERROR]${RESET} $*"; exit 1; }

echo ""
echo -e "${BOLD}╔══════════════════════════════════╗${RESET}"
echo -e "${BOLD}║      AssetFlow — Setup           ║${RESET}"
echo -e "${BOLD}╚══════════════════════════════════╝${RESET}"
echo ""

# ── 1. Prerequisite checks ────────────────────
info "Checking prerequisites..."

command -v node >/dev/null 2>&1 || error "Node.js not found. Install Node.js 18+ from https://nodejs.org"
NODE_VER=$(node -e "process.exit(parseInt(process.versions.node) < 18 ? 1 : 0)" 2>&1 && echo ok || echo fail)
[ "$NODE_VER" = "fail" ] && error "Node.js 18+ required. Current: $(node -v)"
success "Node.js $(node -v)"

# Detect package manager
if command -v pnpm >/dev/null 2>&1; then
  PKG="pnpm"
elif command -v yarn >/dev/null 2>&1; then
  PKG="yarn"
else
  PKG="npm"
fi
success "Package manager: $PKG"

# ── 2. Install dependencies ───────────────────
info "Installing dependencies..."
$PKG install
success "Dependencies installed."

# ── 3. .env setup ─────────────────────────────
if [ ! -f ".env" ]; then
  if [ -f ".env.example" ]; then
    cp .env.example .env
    info ".env created from .env.example"
  else
    cat > .env << 'EOF'
# Database
DATABASE_URL="mysql://USER:PASSWORD@localhost:3306/assetflow"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET=""
EOF
    info ".env created with defaults"
  fi

  # Generate NEXTAUTH_SECRET
  if command -v openssl >/dev/null 2>&1; then
    SECRET=$(openssl rand -base64 32)
    # portable sed for macOS and Linux
    sed -i.bak "s|NEXTAUTH_SECRET=\"\"|NEXTAUTH_SECRET=\"${SECRET}\"|" .env && rm -f .env.bak
    success "NEXTAUTH_SECRET generated automatically."
  else
    warn "openssl not found. Set NEXTAUTH_SECRET manually in .env"
  fi

  echo ""
  warn "────────────────────────────────────────────────────"
  warn "Edit .env and set DATABASE_URL before continuing."
  warn "Example: mysql://root:password@localhost:3306/assetflow"
  warn "────────────────────────────────────────────────────"
  echo ""
  read -rp "Press ENTER when .env is ready, or Ctrl+C to abort: "
else
  success ".env already exists — skipping."
fi

# ── 4. Validate DATABASE_URL ──────────────────
DB_URL=$(grep -E "^DATABASE_URL=" .env | cut -d '=' -f2- | tr -d '"')
if [ -z "$DB_URL" ] || [[ "$DB_URL" == *"USER:PASSWORD"* ]]; then
  error "DATABASE_URL is not configured. Edit .env and re-run this script."
fi
success "DATABASE_URL found."

# ── 5. Prisma generate + migrate ─────────────
info "Generating Prisma client..."
$PKG run db:generate
success "Prisma client generated."

info "Running database migrations..."
$PKG run db:migrate
success "Migrations applied."

# ── 6. Seed ───────────────────────────────────
echo ""
read -rp "Load seed data (demo categories + admin user)? [Y/n]: " SEED_CONFIRM
SEED_CONFIRM="${SEED_CONFIRM:-Y}"
if [[ "$SEED_CONFIRM" =~ ^[Yy]$ ]]; then
  info "Seeding database..."
  $PKG run db:seed
  success "Seed complete."
  echo ""
  echo -e "  ${BOLD}Default admin credentials:${RESET}"
  echo -e "  Email   : admin@assetflow.local"
  echo -e "  Password: admin123!"
  echo -e "  ${YELLOW}Change the password after first login.${RESET}"
else
  info "Seed skipped."
fi

# ── 7. Done ───────────────────────────────────
echo ""
echo -e "${GREEN}${BOLD}✓ Setup complete!${RESET}"
echo ""
echo -e "  Start development server : ${BOLD}$PKG run dev${RESET}"
echo -e "  Build for production     : ${BOLD}$PKG run build && $PKG run start${RESET}"
echo -e "  Open Prisma Studio       : ${BOLD}$PKG run db:studio${RESET}"
echo ""
