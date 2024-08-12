const graphqlEndpoint = 'https://01.kood.tech/api/graphql-engine/v1/graphql';
let jwtToken = '';

document.addEventListener('DOMContentLoaded', () => {
    const loginElement = document.getElementById('login');
    const profileElement = document.getElementById('profile');
    
    if (!loginElement || !profileElement) {
        console.error('Essential elements are missing from the HTML.');
        return;
    }

    jwtToken = Cookies.get('jwtToken');
    if (jwtToken) {
        loginElement.style.display = 'none';
        profileElement.style.display = 'block';
        loadUserProfile();
    }


const usernameElement = document.getElementById('username');
    const passwordElement = document.getElementById('password');

    if (usernameElement && passwordElement) {
        usernameElement.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                handleLogin();
            }
        });
        passwordElement.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                handleLogin();
            }
        });
    }
});

function handleLogin() {
    const usernameElement = document.getElementById('username');
    const passwordElement = document.getElementById('password');
    const loginErrorElement = document.getElementById('loginError');

    if (!usernameElement || !passwordElement || !loginErrorElement) {
        console.error('Login elements are missing from the HTML.');
        return;
    }

    const email = usernameElement.value;
    const password = passwordElement.value;
    const credentials = btoa(`${email}:${password}`);

    console.log('Logging in with:', { email, password });

    fetch('https://01.kood.tech/api/auth/signin', {
        method: 'POST',
        headers: {
            'Authorization': `Basic ${credentials}`
        }
    })
    .then(response => {
        console.log('Login response status:', response.status);
        if (!response.ok) {
            throw new Error('Login failed');
        }
        return response.json();
    })
    .then(data => {
        console.log('Login response data:', data);
        if (data && typeof data === 'string') {
            jwtToken = data;
            Cookies.set('jwtToken', jwtToken, { expires: 1 });
            document.getElementById('login').style.display = 'none';
            document.getElementById('profile').style.display = 'block';
            loadUserProfile();
        } else {
            loginErrorElement.innerText = 'Invalid credentials';
        }
    })
    .catch(error => {
        console.error('Login error:', error);
        loginErrorElement.innerText = 'Login failed';
    });
}

function handleLogout() {
    jwtToken = '';
    Cookies.remove('jwtToken');
    document.getElementById('login').style.display = 'block';
    document.getElementById('profile').style.display = 'none';
}

function loadUserProfile() {
    jwtToken = Cookies.get('jwtToken');
    if (!jwtToken) {
        document.getElementById('loginError').innerText = 'Please login again';
        return;
    }

    const userInfoQuery = `
    query {
        user {
            id
            login
            createdAt
            auditRatio
            campus
            email
            firstName
            lastName
            totalUp
            totalDown
        }
    }`;

    fetch(graphqlEndpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${jwtToken}`,
        },
        body: JSON.stringify({ query: userInfoQuery })
    })
    .then(response => response.json())
    .then(data => {
        console.log('User profile data:', data);
        if (data && data.data && data.data.user) {
            const user = data.data.user[0];
            const roundedAuditRatio = user.auditRatio.toFixed(1);
           
            let tableHTML = `
                <table>
                    <tr><td>Username</td><td>${user.login}</td></tr>
                    <tr><td>First name</td><td>${user.firstName}</td></tr>
                    <tr><td>Last name</td><td>${user.lastName}</td></tr>
                    <tr><td>Email</td><td>${user.email}</td></tr>
                    <tr><td>Created at</td><td>${new Date(user.createdAt).toLocaleDateString()}</td></tr>
                    <tr><td>Audit ratio</td><td>${roundedAuditRatio}</td></tr>
                </table>
            `;
            document.getElementById('userInfo').innerHTML = tableHTML;
        } else {
            document.getElementById('loginError').innerText = 'Failed to load profile data';
        }
    })
    .catch(error => {
        console.error('Profile fetch error:', error);
        document.getElementById('loginError').innerText = 'Error loading profile data';
    });
    loadTransactionTable();
}

function loadTransactionTable() {
    const transactionQuery = `
    query {
        transaction(where: { type: { _eq: "xp" }, createdAt: { _gte: "2024-01-01T00:00:00+00:00" } }) {
            id
            type
            amount
            createdAt
        }
    }`;

    fetch(graphqlEndpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${jwtToken}`,
        },
        body: JSON.stringify({ query: transactionQuery })
    })
    .then(response => response.json())
    .then(data => {
        console.log('Transaction data:', data);
        if (data && data.data && data.data.transaction) {
            const transactions = data.data.transaction;
            
            const xpDataByMonth = d3.rollup(
                transactions,
                v => d3.sum(v, d => d.amount),
                d => d3.timeMonth(d3.isoParse(d.createdAt))
            );

            const xpData = Array.from(xpDataByMonth, ([date, amount]) => ({ date, amount }));

            renderBarChart(xpData);
        } else {
            console.error('Failed to load transaction data');
        }
    })
    .catch(error => {
        console.error('Transaction fetch error:', error);
    });
}

function renderBarChart(xpData) {
    const margin = { top: 20, right: 30, bottom: 40, left: 80 };
    const width = 800 - margin.left - margin.right;
    const height = 400 - margin.top - margin.bottom;

    const svg = d3.select("#chartContainer")
                  .append("svg")
                  .attr("width", width + margin.left + margin.right)
                  .attr("height", height + margin.top + margin.bottom)
                  .append("g")
                  .attr("transform", `translate(${margin.left},${margin.top})`);

    const x = d3.scaleBand()
                .domain(xpData.map(d => d3.timeFormat("%B %Y")(d.date)))
                .range([0, width])
                .padding(0.1);

    const y = d3.scaleLinear()
                .domain([0, d3.max(xpData, d => d.amount)])
                .nice()
                .range([height, 0]);

    const yAxis = d3.axisLeft(y)
                    .tickFormat(d3.format(",d")); 

    svg.append("g")
       .attr("transform", `translate(0,${height})`)
       .call(d3.axisBottom(x));

    svg.append("g")
       .call(yAxis);

    svg.selectAll(".bar")
       .data(xpData)
       .enter().append("rect")
       .attr("class", "bar")
       .attr("x", d => x(d3.timeFormat("%B %Y")(d.date)))
       .attr("y", d => y(d.amount))
       .attr("width", x.bandwidth())
       .attr("height", d => height - y(d.amount))
       .attr("fill", "#d15af25e")
       .on("mouseover", function(event, d) {
        d3.select(this).attr("fill", "#5e00789a");
   })
   .on("mouseout", function(event, d) {
        d3.select(this).attr("fill", "#d15af25e");
   });

    svg.selectAll(".text")
       .data(xpData)
       .enter().append("text")
       .attr("x", d => x(d3.timeFormat("%B %Y")(d.date)) + x.bandwidth() / 2)
       .attr("y", d => y(d.amount) - 5)
       .attr("text-anchor", "middle")
       .attr("fill", "white")
       .text(d => d.amount);

}
