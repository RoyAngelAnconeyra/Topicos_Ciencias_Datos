document.addEventListener("DOMContentLoaded", function () {
    const dataPath = 'data/data_clinic.csv';

    // Dimensiones del gráfico principal
    const margin = { top: 40, right: 120, bottom: 60, left: 80 };
    const width = 1560 - margin.left - margin.right;
    const height = 500 - margin.top - margin.bottom;

    // Dimensiones del gráfico en el tooltip
    const tooltipWidth = 400;
    const tooltipHeight = 200;
    const tooltipMargin = { top: 20, right: 20, bottom: 40, left: 40 };

    // Escalas
    let x = d3.scaleTime().range([0, width]);
    let y = d3.scaleLinear().range([height, 0]);
    let color = d3.scaleOrdinal(d3.schemeCategory10);

    // Funciones para parsear fechas y horas
    const parseDate = d3.timeParse("%Y-%m-%d");
    const parseTime = d3.timeParse("%H:%M:%S");
    const parseDateTime = d3.timeParse("%Y-%m-%d %H:%M:%S");

    // Atributos numéricos para las series temporales con sus unidades
    const timeSeriesAttributes = [
        { name: "age", unit: "years" },
        { name: "temperature", unit: "°C" },
        { name: "abp_systolic", unit: "mmHg" },
        { name: "abp_diastolic", unit: "mmHg" },
        { name: "abp_mean", unit: "mmHg" },
        { name: "heart_rate", unit: "bpm" },
        { name: "oxygen_saturation", unit: "%" },
        { name: "weight", unit: "kg" },
        { name: "creatine", unit: "mg/dL" },
        { name: "ph", unit: "" },
        { name: "sodium", unit: "mmol/L" },
        { name: "potassium", unit: "mmol/L" },
        { name: "hematocrit", unit: "%" },
        { name: "bilirubin", unit: "mg/dL" }
    ];

    // Símbolos para diferentes puntos
    const symbols = [
        d3.symbolCircle,
        d3.symbolSquare,
        d3.symbolTriangle,
        d3.symbolCross,
        d3.symbolDiamond,
        d3.symbolStar,
        d3.symbolWye
    ];
    const symbolGenerator = d3.symbol().size(64);
    const symbolMap = new Map(timeSeriesAttributes.map((attr, i) => [attr.name, symbols[i % symbols.length]]));

    let fullData = [];
    let filteredData = [];
    let selectedAttributes = [];

    // Inicializar SVG principal
    const svg = d3.select("#chart")
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // Ejes principales
    const xAxisG = svg.append("g")
        .attr("class", "x axis")
        .attr("transform", `translate(0,${height})`);
    
    const yAxisG = svg.append("g")
        .attr("class", "y axis");

    // Etiquetas de ejes principales
    svg.append("text")
        .attr("class", "axis-label")
        .attr("transform", "rotate(-90)")
        .attr("y", 0 - margin.left)
        .attr("x", 0 - (height / 2))
        .attr("dy", "1em")
        .style("text-anchor", "middle")

    svg.append("text")
        .attr("class", "axis-label")
        .attr("transform", `translate(${width / 2}, ${height + margin.top})`)
        .style("text-anchor", "middle")
    // Tooltip para información al pasar el mouse
    const tooltip = d3.select("#chart")
        .append("div")
        .attr("class", "tooltip")
        .style("opacity", 0);

    // Tooltip para la serie temporal por hora
    const hourlyTooltip = d3.select("#chart")
        .append("div")
        .attr("class", "hourly-tooltip")
        .style("opacity", 0);

    // Botón de cerrar en el tooltip
    hourlyTooltip.append("div")
        .attr("class", "close-btn")
        .html("×")
        .on("click", function () {
            hourlyTooltip.transition().duration(200).style("opacity", 0);
            hourlyTooltip.select("svg").remove();
        });

    // Toggle Sidebar
    document.getElementById("menu-toggle").addEventListener("click", function (e) {
        e.preventDefault();
        document.getElementById("sidebar-wrapper").classList.toggle("toggled");
    });

    // Carga de datos
    d3.csv(dataPath).then(data => {
        fullData = data.map(d => {
            d.date = parseDate(d.date);
            if (d.time) {
                d.time = parseTime(d.time);
                if (d.date && d.time) {
                    d.datetime = new Date(
                        d.date.getFullYear(),
                        d.date.getMonth(),
                        d.date.getDate(),
                        d.time.getHours(),
                        d.time.getMinutes(),
                        d.time.getSeconds()
                    );
                }
            }
            d.age = +d.age;
            timeSeriesAttributes.forEach(attr => {
                d[attr.name] = +d[attr.name];
            });
            return d;
        }).filter(d => (d.date && d.date instanceof Date && !isNaN(d.date.getTime())) || 
                      (d.datetime && d.datetime instanceof Date && !isNaN(d.datetime.getTime())));

        // Configurar rangos de fecha
        const minDate = d3.min(fullData, d => d.date);
        const maxDate = d3.max(fullData, d => d.date);
        document.getElementById('startDate').min = minDate ? minDate.toISOString().split('T')[0] : '';
        document.getElementById('startDate').max = maxDate ? maxDate.toISOString().split('T')[0] : '';
        document.getElementById('endDate').min = minDate ? minDate.toISOString().split('T')[0] : '';
        document.getElementById('endDate').max = maxDate ? maxDate.toISOString().split('T')[0] : '';

        populateGenderFilter();
        applyFiltersAndPopulateSubjects();
        generateAttributeCheckboxes();
    }).catch(error => {
        console.error("Error al cargar o parsear los datos CSV:", error);
    });

    function populateGenderFilter() {
        const genderFilter = document.getElementById('genderFilter');
        const genders = [...new Set(fullData.map(d => d.gender))].sort();
        genders.forEach(gender => {
            const option = document.createElement('option');
            option.value = gender;
            option.textContent = gender;
            genderFilter.appendChild(option);
        });
    }

    function populateSubjectIdFilter(dataToFilter) {
        const subjectIdFilter = document.getElementById('subjectIdFilter');
        subjectIdFilter.innerHTML = '<option value="">Seleccionar Sujeto</option>';
        const subjectIds = [...new Set(dataToFilter.map(d => d.subject_id))].sort();
        subjectIds.forEach(id => {
            const option = document.createElement('option');
            option.value = id;
            option.textContent = id;
            subjectIdFilter.appendChild(option);
        });
    }

    function generateAttributeCheckboxes() {
        const attributeCheckboxesDiv = document.getElementById('attributeCheckboxes');
        attributeCheckboxesDiv.innerHTML = '';
        timeSeriesAttributes.forEach(attr => {
            const div = document.createElement('div');
            div.className = 'form-check';
            const input = document.createElement('input');
            input.type = 'checkbox';
            input.className = 'form-check-input';
            input.id = `checkbox-${attr.name}`;
            input.value = attr.name;
            input.addEventListener('change', updateSelectedAttributes);
            const label = document.createElement('label');
            label.className = 'form-check-label';
            label.setAttribute('for', `checkbox-${attr.name}`);
            label.textContent = `${attr.name} (${attr.unit})`;
            div.appendChild(input);
            div.appendChild(label);
            attributeCheckboxesDiv.appendChild(div);
        });
    }

    function updateSelectedAttributes(event) {
        const attribute = event.target.value;
        if (event.target.checked) {
            if (!selectedAttributes.includes(attribute)) {
                selectedAttributes.push(attribute);
            }
        } else {
            selectedAttributes = selectedAttributes.filter(attr => attr !== attribute);
        }
        updateChart();
    }

    document.getElementById('applyFiltersBtn').addEventListener('click', applyFilters);
    document.getElementById('genderFilter').addEventListener('change', applyFiltersAndPopulateSubjects);
    document.getElementById('minAge').addEventListener('change', applyFiltersAndPopulateSubjects);
    document.getElementById('maxAge').addEventListener('change', applyFiltersAndPopulateSubjects);
    document.getElementById('timeScale').addEventListener('change', updateChart);

    function applyFiltersAndPopulateSubjects() {
        const gender = document.getElementById('genderFilter').value;
        const minAge = parseInt(document.getElementById('minAge').value) || 0;
        const maxAge = parseInt(document.getElementById('maxAge').value) || Infinity;
        let tempFilteredData = fullData.filter(d => {
            const meetsGender = !gender || d.gender === gender;
            const meetsAge = d.age >= minAge && d.age <= maxAge;
            return meetsGender && meetsAge;
        });
        populateSubjectIdFilter(tempFilteredData);
    }

    function applyFilters() {
        const selectedSubjectId = document.getElementById('subjectIdFilter').value;
        const gender = document.getElementById('genderFilter').value;
        const minAge = parseInt(document.getElementById('minAge').value) || 0;
        const maxAge = parseInt(document.getElementById('maxAge').value) || Infinity;
        const startDateStr = document.getElementById('startDate').value;
        const endDateStr = document.getElementById('endDate').value;
        const startDate = startDateStr ? parseDate(startDateStr) : null;
        const endDate = endDateStr ? parseDate(endDateStr) : null;

        filteredData = fullData.filter(d => {
            const meetsSubjectId = !selectedSubjectId || d.subject_id === selectedSubjectId;
            const meetsGender = !gender || d.gender === gender;
            const meetsAge = d.age >= minAge && d.age <= maxAge;
            
            let meetsDateRange = true;
            if (startDate || endDate) {
                if (d.datetime) {
                    meetsDateRange = (!startDate || d.datetime >= startDate) && 
                                    (!endDate || d.datetime <= new Date(endDate.getTime() + 86400000));
                } else if (d.date) {
                    meetsDateRange = (!startDate || d.date >= startDate) && 
                                   (!endDate || d.date <= new Date(endDate.getTime() + 86400000));
                }
            }
            
            return meetsSubjectId && meetsGender && meetsAge && meetsDateRange;
        });

        if (selectedSubjectId && !filteredData.some(d => d.subject_id === selectedSubjectId)) {
            document.getElementById('subjectIdFilter').value = "";
            filteredData = fullData.filter(d => {
                const meetsGender = !gender || d.gender === gender;
                const meetsAge = d.age >= minAge && d.age <= maxAge;
                
                let meetsDateRange = true;
                if (startDate || endDate) {
                    if (d.datetime) {
                        meetsDateRange = (!startDate || d.datetime >= startDate) && 
                                        (!endDate || d.datetime <= new Date(endDate.getTime() + 86400000));
                    } else if (d.date) {
                        meetsDateRange = (!startDate || d.date >= startDate) && 
                                         (!endDate || d.date <= new Date(endDate.getTime() + 86400000));
                    }
                }
                
                return meetsGender && meetsAge && meetsDateRange;
            });
        }

        updateChart();
    }

    function updateChart() {
        svg.selectAll(".line").remove();
        svg.selectAll(".legend").remove();
        svg.selectAll(".tooltip-circle").remove();

        if (filteredData.length === 0 || selectedAttributes.length === 0) return;

        const timeScale = document.getElementById('timeScale').value;
        const timeKey = timeScale === 'time' ? 'datetime' : 'date';

        // Establecer dominios
        x.domain(d3.extent(filteredData, d => d[timeKey]));

        let allValues = [];
        selectedAttributes.forEach(attr => {
            allValues = allValues.concat(filteredData.map(d => d[attr]).filter(val => !isNaN(val)));
        });
        y.domain([d3.min(allValues), d3.max(allValues)]);

        // Dibujar ejes
        xAxisG.transition().duration(500).call(d3.axisBottom(x));
        yAxisG.transition().duration(500).call(d3.axisLeft(y));

        // Dibujar líneas
        selectedAttributes.forEach((attr, i) => {
            const line = d3.line()
                .x(d => x(d[timeKey]))
                .y(d => y(d[attr]))
                .defined(d => !isNaN(d[attr]));

            svg.append("path")
                .datum(filteredData.filter(d => !isNaN(d[attr])))
                .attr("class", "line")
                .attr("fill", "none")
                .attr("stroke", color(attr))
                .attr("stroke-width", 2)
                .attr("d", line);

            // Puntos interactivos
            svg.selectAll(`.tooltip-circle-${attr}`)
                .data(filteredData.filter(d => !isNaN(d[attr])))
                .enter()
                .append("circle")
                .attr("class", `tooltip-circle tooltip-circle-${attr}`)
                .attr("cx", d => x(d[timeKey]))
                .attr("cy", d => y(d[attr]))
                .attr("r", 4)
                .attr("fill", color(attr))
                .on("mouseover", function (event, d) {
                    tooltip.transition().duration(200).style("opacity", .9);
                    tooltip.html(
                        `<strong>${attr}</strong><br>` +
                        `Valor: ${d[attr]}<br>` +
                        `Edad: ${d.age}<br>` +
                        `Fecha: ${d[timeKey].toLocaleString()}`
                    )
                    .style("left", (x(d[timeKey]) + margin.left + 10) + "px")
                    .style("top", (y(d[attr]) + margin.top - 28) + "px");
                })
                .on("mouseout", function () {
                    tooltip.transition().duration(500).style("opacity", 0);
                })
                .on("click", function (event, d) {
                    if (timeScale === 'date') {
                        tooltip.style("opacity", 0); // Ocultar tooltip original
                        showHourlyTooltip(d, attr, x(d[timeKey]), y(d[attr]));
                    }
                });
        });

        // Leyenda
        const legend = svg.selectAll(".legend")
            .data(selectedAttributes)
            .enter()
            .append("g")
            .attr("class", "legend")
            .attr("transform", (d, i) => `translate(0, ${i * 20})`);

        legend.append("rect")
            .attr("x", width + 10)
            .attr("width", 18)
            .attr("height", 18)
            .style("fill", d => color(d));

        legend.append("text")
            .attr("x", width + 35)
            .attr("y", 9)
            .attr("dy", ".35em")
            .style("text-anchor", "start")
            .text(d => d);
    }

    function showHourlyTooltip(d, attr, xPos, yPos) {
        const selectedDate = new Date(d.date.getFullYear(), d.date.getMonth(), d.date.getDate());
        const hourlyData = filteredData.filter(h => 
            h.datetime &&
            h.datetime.getFullYear() === selectedDate.getFullYear() &&
            h.datetime.getMonth() === selectedDate.getMonth() &&
            h.datetime.getDate() === selectedDate.getDate() &&
            !isNaN(h[attr])
        );

        if (hourlyData.length === 0) {
            hourlyTooltip.transition().duration(200).style("opacity", 0);
            return;
        }

        // Limpiar contenido previo
        hourlyTooltip.select("svg").remove();

        // Crear SVG dentro del tooltip
        const tooltipSvg = hourlyTooltip.append("svg")
            .attr("width", tooltipWidth)
            .attr("height", tooltipHeight)
            .append("g")
            .attr("transform", `translate(${tooltipMargin.left},${tooltipMargin.top})`);

        // Escalas para el tooltip
        const xTooltip = d3.scaleTime()
            .domain(d3.extent(hourlyData, h => h.datetime))
            .range([0, tooltipWidth - tooltipMargin.left - tooltipMargin.right]);

        const yTooltip = d3.scaleLinear()
            .domain(d3.extent(hourlyData, h => h[attr]))
            .range([tooltipHeight - tooltipMargin.top - tooltipMargin.bottom, 0]);

        // Línea
        const lineTooltip = d3.line()
            .x(h => xTooltip(h.datetime))
            .y(h => yTooltip(h[attr]))
            .defined(h => !isNaN(h[attr]));

        tooltipSvg.append("path")
            .datum(hourlyData)
            .attr("class", "line")
            .attr("fill", "none")
            .attr("stroke", color(attr))
            .attr("stroke-width", 2)
            .attr("d", lineTooltip);

        // Puntos
        tooltipSvg.selectAll(`.tooltip-circle-${attr}`)
            .data(hourlyData)
            .enter()
            .append("circle")
            .attr("class", `tooltip-circle tooltip-circle-${attr}`)
            .attr("cx", h => xTooltip(h.datetime))
            .attr("cy", h => yTooltip(h[attr]))
            .attr("r", 4)
            .attr("fill", color(attr));

        // Ejes
        tooltipSvg.append("g")
            .attr("class", "x axis")
            .attr("transform", `translate(0,${tooltipHeight - tooltipMargin.top - tooltipMargin.bottom})`)
            .call(d3.axisBottom(xTooltip).ticks(5));

        tooltipSvg.append("g")
            .attr("class", "y axis")
            .call(d3.axisLeft(yTooltip).ticks(5));

        // Mostrar tooltip
        hourlyTooltip.transition().duration(200).style("opacity", .9)
            .style("left", (xPos + margin.left + 10) + "px")
            .style("top", (yPos + margin.top - tooltipHeight - 10) + "px");
    }
});