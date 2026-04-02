(function () {
    const sections = document.querySelectorAll(".section");
    const dots = document.querySelectorAll(".timeline-dot");
    const timelineFill = document.querySelector(".timeline-line-fill");
    const scrollProgress = document.querySelector(".scroll-progress");
    const keyboardHint = document.querySelector(".keyboard-hint");
    const staggerGroups = document.querySelectorAll(".stagger-children");

    let currentIndex = 0;

    /* ── Scroll progress bar + timeline fill ───── */
    function updateScrollIndicators() {
        const scrollTop = window.scrollY;
        const docHeight = document.documentElement.scrollHeight - window.innerHeight;
        const pct = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;

        scrollProgress.style.width = pct + "%";
        timelineFill.style.height = pct + "%";
    }

    window.addEventListener("scroll", updateScrollIndicators, { passive: true });
    updateScrollIndicators();

    /* ── Fade-in observer ──────────────────────── */
    const fadeObserver = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.querySelector(".fade-in")?.classList.add("visible");
                }
            });
        },
        { threshold: 0.15 }
    );

    /* ── Stagger children observer ─────────────── */
    const staggerObserver = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.classList.add("stagger-visible");
                }
            });
        },
        { threshold: 0.2 }
    );

    staggerGroups.forEach((group) => staggerObserver.observe(group));

    /* ── Active dot observer ───────────────────── */
    const dotObserver = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    const index = Number(entry.target.id.replace("section-", ""));
                    setActiveDot(index);
                    currentIndex = index;

                    // Trigger black swan effects (persist once activated)
                    if (
                        entry.target.classList.contains("black-swan") &&
                        !entry.target.classList.contains("swan-active")
                    ) {
                        entry.target.classList.add("swan-active");
                    }
                }
            });
        },
        { threshold: 0.4 }
    );

    sections.forEach((section) => {
        fadeObserver.observe(section);
        dotObserver.observe(section);
    });

    function setActiveDot(index) {
        dots.forEach((dot) => dot.classList.remove("active"));
        if (dots[index]) {
            dots[index].classList.add("active");
        }
    }

    /* ── Click dot → scroll to section ─────────── */
    dots.forEach((dot) => {
        dot.addEventListener("click", () => {
            const index = dot.dataset.index;
            const target = document.getElementById("section-" + index);
            if (target) {
                target.scrollIntoView({ behavior: "smooth" });
            }
        });
    });

    /* ── Expandable cards & branches ───────────── */
    document.querySelectorAll(".expandable").forEach((el) => {
        function toggle() {
            const isExpanded = el.classList.toggle("expanded");
            el.setAttribute("aria-expanded", isExpanded);
        }

        el.addEventListener("click", toggle);
        el.addEventListener("keydown", (e) => {
            if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                toggle();
            }
        });
    });

    /* ── Keyboard navigation (↑ / ↓) ──────────── */
    document.addEventListener("keydown", (e) => {
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            // Don't hijack if user is focused on an expandable
            if (document.activeElement.classList.contains("expandable")) return;

            e.preventDefault();
            if (e.key === "ArrowDown" && currentIndex < sections.length - 1) {
                currentIndex++;
            } else if (e.key === "ArrowUp" && currentIndex > 0) {
                currentIndex--;
            }
            sections[currentIndex].scrollIntoView({ behavior: "smooth" });
        }
    });

    /* ── Hide keyboard hint after first scroll ─── */
    let hintHidden = false;
    window.addEventListener(
        "scroll",
        () => {
            if (!hintHidden && window.scrollY > 200) {
                hintHidden = true;
                keyboardHint?.classList.add("hidden");
            }
        },
        { passive: true }
    );
})();

/* ── Connecting lines (SVG) ───────────────────── */
(function () {
    const svg = document.querySelector(".connecting-lines");
    const layerDots = svg.querySelector(".layer-dots");
    const layerConnectors = svg.querySelector(".layer-connectors");
    const layerCards = svg.querySelector(".layer-cards");
    const layerBranches = svg.querySelector(".layer-branches");
    const dots = document.querySelectorAll(".timeline-dot");
    const sections = document.querySelectorAll(".section");
    const allPaths = []; // { path, sectionEl, drawn }

    function clearLayer(layer) {
        while (layer.firstChild) layer.removeChild(layer.firstChild);
    }

    function makePath(d, stroke, layer) {
        const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
        p.setAttribute("d", d);
        p.setAttribute("stroke", stroke);
        layer.appendChild(p);
        const len = p.getTotalLength();
        p.style.strokeDasharray = len;
        p.style.strokeDashoffset = len;
        return { path: p, len };
    }

    function bezierH(x1, y1, x2, y2) {
        const cx = x1 + (x2 - x1) * 0.5;
        return `M ${x1} ${y1} C ${cx} ${y1}, ${cx} ${y2}, ${x2} ${y2}`;
    }

    function bezierV(x1, y1, x2, y2) {
        const cy = y1 + (y2 - y1) * 0.45;
        return `M ${x1} ${y1} C ${x1} ${cy}, ${x2} ${cy}, ${x2} ${y2}`;
    }

    function getPos(el) {
        const r = el.getBoundingClientRect();
        return {
            top: r.top + window.scrollY,
            bottom: r.bottom + window.scrollY,
            left: r.left + window.scrollX,
            right: r.right + window.scrollX,
            cx: r.left + r.width / 2 + window.scrollX,
            cy: r.top + r.height / 2 + window.scrollY,
            width: r.width,
            height: r.height,
        };
    }

    function buildAll() {
        clearLayer(layerDots);
        clearLayer(layerConnectors);
        clearLayer(layerCards);
        clearLayer(layerBranches);
        allPaths.length = 0;

        const docH = document.documentElement.scrollHeight;
        svg.setAttribute("width", window.innerWidth);
        svg.setAttribute("height", docH);
        svg.style.height = docH + "px";

        // 1) Dot-to-section lines (thicker + glow)
        dots.forEach((dot, i) => {
            const section = sections[i];
            if (!section) return;
            const sectionInner = section.querySelector(".section-inner");
            if (!sectionInner) return;

            const dp = getPos(dot);
            const sp = getPos(sectionInner);
            const isSwan = section.classList.contains("black-swan");

            const d = bezierH(dp.right, dp.cy, sp.left - 10, sp.top + 28);
            const { path } = makePath(d, isSwan ? "url(#line-grad-swan)" : "url(#line-grad)", layerDots);
            allPaths.push({ path, sectionEl: section, drawn: false });
        });

        // 2) Inter-section vertical connectors
        for (let i = 0; i < sections.length - 1; i++) {
            const innerA = sections[i].querySelector(".section-inner");
            const innerB = sections[i + 1].querySelector(".section-inner");
            if (!innerA || !innerB) continue;

            const a = getPos(innerA);
            const b = getPos(innerB);

            const x1 = a.left + 30;
            const y1 = a.bottom - 10;
            const x2 = b.left + 30;
            const y2 = b.top + 10;

            const d = bezierV(x1, y1, x2, y2);
            const { path } = makePath(d, "url(#line-grad-vert)", layerConnectors);
            // Trigger on the next section
            allPaths.push({ path, sectionEl: sections[i + 1], drawn: false });
        }

        // 3) Card-to-card connectors within card-rows
        document.querySelectorAll(".card-row").forEach((row) => {
            const cards = row.querySelectorAll(".card");
            if (cards.length < 2) return;
            const section = row.closest(".section");

            for (let i = 0; i < cards.length - 1; i++) {
                const a = getPos(cards[i]);
                const b = getPos(cards[i + 1]);

                const x1 = a.right - 5;
                const y1 = a.cy;
                const x2 = b.left + 5;
                const y2 = b.cy;

                const cx = x1 + (x2 - x1) * 0.5;
                const d = `M ${x1} ${y1} C ${cx} ${y1}, ${cx} ${y2}, ${x2} ${y2}`;
                const { path } = makePath(d, "url(#card-conn-grad)", layerCards);
                allPaths.push({ path, sectionEl: section, drawn: false });
            }
        });

        // 4) Branching lines in the divergence section
        const branchSection = sections[3]; // Post-2030
        if (branchSection) {
            const branches = branchSection.querySelectorAll(".branch");
            const sectionInner = branchSection.querySelector(".section-inner");
            if (sectionInner && branches.length >= 3) {
                const heading = branchSection.querySelector("h2");
                if (heading) {
                    const hp = getPos(heading);
                    const originX = hp.left + 20;
                    const originY = hp.bottom + 15;

                    const gradIds = [
                        "url(#branch-grad-possible)",
                        "url(#branch-grad-plausible)",
                        "url(#branch-grad-probable)",
                    ];

                    branches.forEach((branch, i) => {
                        const bp = getPos(branch);
                        const targetX = bp.left + 10;
                        const targetY = bp.top + 18;

                        const cy1 = originY + (targetY - originY) * 0.3;
                        const cy2 = originY + (targetY - originY) * 0.7;
                        const d = `M ${originX} ${originY} C ${originX} ${cy1}, ${targetX} ${cy2}, ${targetX} ${targetY}`;

                        const { path } = makePath(d, gradIds[i] || gradIds[0], layerBranches);
                        allPaths.push({ path, sectionEl: branchSection, drawn: false });
                    });
                }
            }
        }
    }

    // Observer: draw + start flowing animation
    const lineObserver = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                allPaths.forEach((item) => {
                    if (item.sectionEl === entry.target && !item.drawn) {
                        item.drawn = true;
                        item.path.style.strokeDashoffset = "0";
                        // After draw-in completes, switch to flowing dash
                        setTimeout(() => {
                            item.path.style.strokeDasharray = "10 10";
                            item.path.style.strokeDashoffset = "0";
                            item.path.classList.add("flowing");
                        }, 900);
                    }
                });
            });
        },
        { threshold: 0.12 }
    );

    function init() {
        buildAll();
        const observed = new Set();
        allPaths.forEach((p) => {
            if (!observed.has(p.sectionEl)) {
                observed.add(p.sectionEl);
                lineObserver.observe(p.sectionEl);
            }
        });
    }

    let resizeTimer;
    window.addEventListener("resize", () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            allPaths.forEach((p) => {
                p.drawn = false;
                p.path.classList.remove("flowing");
            });
            // Unobserve all
            sections.forEach((s) => lineObserver.unobserve(s));
            init();
        }, 250);
    });

    requestAnimationFrame(() => requestAnimationFrame(init));
})();

/* ── Particle background ─────────────────────── */
(function () {
    const canvas = document.getElementById("particles");
    const ctx = canvas.getContext("2d");
    let w, h;
    let swanVisible = false;

    function resize() {
        w = canvas.width = window.innerWidth;
        h = canvas.height = window.innerHeight;
    }
    window.addEventListener("resize", resize);
    resize();

    // Track whether a black-swan section is on screen
    const swanSections = document.querySelectorAll(".black-swan");
    const swanObserver = new IntersectionObserver(
        (entries) => {
            swanVisible = entries.some((e) => e.isIntersecting);
        },
        { threshold: 0.15 }
    );
    swanSections.forEach((s) => swanObserver.observe(s));

    // Particle pool
    const COUNT = 80;
    const particles = [];

    function createParticle() {
        return {
            x: Math.random() * w,
            y: Math.random() * h,
            r: Math.random() * 1.8 + 0.5,
            speed: Math.random() * 0.35 + 0.1,
            drift: (Math.random() - 0.5) * 0.3,
            opacity: Math.random() * 0.5 + 0.15,
        };
    }

    for (let i = 0; i < COUNT; i++) particles.push(createParticle());

    function draw() {
        ctx.clearRect(0, 0, w, h);

        for (const p of particles) {
            // Move upward, slight horizontal drift
            p.y -= p.speed;
            p.x += p.drift;

            // Wrap around
            if (p.y < -10) {
                p.y = h + 10;
                p.x = Math.random() * w;
            }
            if (p.x < -10) p.x = w + 10;
            if (p.x > w + 10) p.x = -10;

            // Color: indigo normally, rose during black swan
            const r = swanVisible ? 244 : 129;
            const g = swanVisible ? 63 : 140;
            const b = swanVisible ? 94 : 248;

            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${r},${g},${b},${p.opacity})`;
            ctx.fill();
        }

        requestAnimationFrame(draw);
    }

    draw();
})();
