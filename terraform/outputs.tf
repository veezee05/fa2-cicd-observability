output "instance_public_ip" {
  description = "Public IP of the EC2 instance"
  value       = aws_instance.web.public_ip
}

output "instance_id" {
  value = aws_instance.web.id
}

output "application_url" {
  value = "http://${aws_instance.web.public_ip}"
}

output "grafana_url" {
  description = "Grafana dashboards (admin / see GRAFANA_PASSWORD)"
  value       = "http://${aws_instance.web.public_ip}:3000"
}

output "prometheus_url" {
  value = "http://${aws_instance.web.public_ip}:9090"
}

output "alertmanager_url" {
  value = "http://${aws_instance.web.public_ip}:9093"
}
