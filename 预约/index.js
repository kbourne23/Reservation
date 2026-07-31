/* ============================================================
   index.js — 物资智慧管理平台 · index.html 交互逻辑
   包含：侧边栏折叠/Tooltip/子菜单浮出/固定/搜索/Tab/天气/用户下拉
============================================================ */

// ─── 时间 & 日期 ─────────────────────────────────────────
function updateTime() {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  const timeEl = document.getElementById('headerTime');
  if (timeEl) timeEl.textContent = hh + ':' + mm + ':' + ss;

  const dateEl = document.getElementById('todayDate');
  if (dateEl) {
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    dateEl.textContent = y + '-' + m + '-' + d;
  }
}
setInterval(updateTime, 1000);
updateTime();

// ─── 侧边栏展开/折叠 ──────────────────────────────────────
const sidebar = document.getElementById('appSidebar');
let isPinned = false;
let isHoveringSidebar = false;
let hoverTimer = null;
let leaveTimer = null;

// 鼠标进入侧边栏
sidebar.addEventListener('mouseenter', function (e) {
  if (isPinned) return;
  clearTimeout(leaveTimer);
  hoverTimer = setTimeout(function () {
    sidebar.classList.add('expanded');
    closeAllPopups();
  }, 60); // 鼠标移入60ms后展开（防误触）
});

// 鼠标离开侧边栏
sidebar.addEventListener('mouseleave', function () {
  if (isPinned) return;
  clearTimeout(hoverTimer);
  leaveTimer = setTimeout(function () {
    sidebar.classList.remove('expanded');
    closeAllFlyouts();
  }, 150); // 鼠标移出150ms后收缩
});

// ─── 固定/取消固定 ─────────────────────────────────────────
function togglePin() {
  isPinned = !isPinned;
  const pinBtn = document.getElementById('pinBtn');
  if (isPinned) {
    sidebar.classList.add('pinned');
    sidebar.classList.remove('expanded');
    pinBtn.classList.add('pinned');
    pinBtn.title = '取消固定菜单';
  } else {
    sidebar.classList.remove('pinned');
    pinBtn.classList.remove('pinned');
    pinBtn.title = '固定菜单';
  }
  closeAllFlyouts();
}

// ─── 子菜单展开/收起 ───────────────────────────────────────
function toggleSubmenu(btn) {
  if (!sidebar.classList.contains('expanded') && !sidebar.classList.contains('pinned')) {
    // 折叠状态 → 显示浮出面板
    showSubmenuFlyout(btn);
    return;
  }
  // 展开状态 → 内嵌展开
  const isOpen = btn.classList.contains('open');
  closeAllSubmenus();
  if (!isOpen) {
    btn.classList.add('open');
  }
}

function closeAllSubmenus() {
  document.querySelectorAll('.nav-item.open').forEach(function (el) {
    el.classList.remove('open');
  });
}

// ─── 子菜单浮出面板 ────────────────────────────────────────
let currentFlyout = null;

function showSubmenuFlyout(triggerBtn) {
  closeAllFlyouts();
  // 浮出面板是按钮的兄弟元素（在 sidebarNav 下），需要从父容器查找
  const nav = document.getElementById('sidebarNav');
  // 找按钮后面最近的 .submenu-flyout
  let flyout = null;
  let sibling = triggerBtn.nextElementSibling;
  while (sibling) {
    if (sibling.classList && sibling.classList.contains('submenu-flyout')) {
      flyout = sibling;
      break;
    }
    sibling = sibling.nextElementSibling;
  }
  if (!flyout) return;

  const rect = triggerBtn.getBoundingClientRect();
  flyout.style.top = rect.top + 'px';
  flyout.style.left = '60px';
  flyout.classList.add('visible');
  currentFlyout = flyout;
}

function closeAllFlyouts() {
  if (currentFlyout) {
    currentFlyout.classList.remove('visible');
    currentFlyout = null;
  }
}

// 点击其他地方关闭浮出面板
document.addEventListener('click', function (e) {
  if (!e.target.closest('.app-sidebar') && !e.target.closest('.submenu-flyout')) {
    closeAllFlyouts();
  }
});

// ─── 菜单搜索过滤 ─────────────────────────────────────────
function filterMenu(query) {
  query = query.trim().toLowerCase();
  const items = document.querySelectorAll('.nav-item');
  items.forEach(function (item) {
    const label = item.getAttribute('data-label') ||
      (item.querySelector('.nav-label') && item.querySelector('.nav-label').textContent) || '';
    if (!query || label.toLowerCase().includes(query)) {
      item.style.display = '';
    } else {
      item.style.display = 'none';
    }
  });
  // 同时隐藏空分组标题
  document.querySelectorAll('.nav-group-title').forEach(function (title) {
    const nextItems = [];
    let sibling = title.nextElementSibling;
    while (sibling && !sibling.classList.contains('nav-group-title')) {
      if (sibling.classList.contains('nav-item') && sibling.style.display !== 'none') {
        nextItems.push(sibling);
      }
      sibling = sibling.nextElementSibling;
    }
    title.style.display = nextItems.length > 0 ? '' : 'none';
  });
}

// ─── 天气弹层 ─────────────────────────────────────────────
function toggleWeather() {
  const p = document.getElementById('weatherPopup');
  const u = document.getElementById('userMenuPopup');
  if (p.style.display === 'none') {
    p.style.display = '';
    u.style.display = 'none';
  } else {
    p.style.display = 'none';
  }
}
function toggleUserMenu() {
  const p = document.getElementById('userMenuPopup');
  const w = document.getElementById('weatherPopup');
  if (p.style.display === 'none') {
    p.style.display = '';
    w.style.display = 'none';
  } else {
    p.style.display = 'none';
  }
}
function closeAllPopups() {
  const p = document.getElementById('weatherPopup');
  const u = document.getElementById('userMenuPopup');
  if (p) p.style.display = 'none';
  if (u) u.style.display = 'none';
}

// 点击空白关闭弹层
document.addEventListener('click', function (e) {
  if (!e.target.closest('#weatherWidget') && !e.target.closest('#weatherPopup')) {
    const p = document.getElementById('weatherPopup');
    if (p) p.style.display = 'none';
  }
  if (!e.target.closest('#userWidget') && !e.target.closest('#userMenuPopup')) {
    const u = document.getElementById('userMenuPopup');
    if (u) u.style.display = 'none';
  }
});

// ─── Tab 切换（从 index.html 复制过来，由外部 script 标签调用）
// （已在 index.html 内联 script 中定义 openTab/switchTab/closeTab/highlightSidebar）

// ─── console 启动提示 ──────────────────────────────────────
console.log('%c物资智慧管理平台', 'color:#0D9488;font-size:18px;font-weight:bold');
console.log('%cSmart Reserve — 智能储备系统 v1.0', 'color:#6b7280');
